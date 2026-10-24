import Conversation from "../models/Conversation.js"; // adjust path/name
import mongoose from "mongoose";
import Call from "../models/Call.js";
import { CALL_POPULATE, serializeCall } from "../controllers/callController.js";

const RING_TIMEOUT_MS = 45_000;
const MAX_PARTICIPANTS = 6; // mesh limit

const calls = new Map();     // conversationId -> call
const userCalls = new Map(); // userId -> conversationId

const personalRoom = (userId) => `user:${userId}`;

function endCall(io, call, reason) {
    clearTimeout(call.timer);
    calls.delete(call.conversationId);
    call.participants.forEach((_, uid) => userCalls.delete(uid));

    // Every member's devices (stops ringing + tears down active calls)
    const payload = { conversationId: call.conversationId, reason };
    call.members.forEach((uid) => io.to(personalRoom(uid)).emit("call:ended", payload));
        logCallEnded(io, call, reason);
}

// Saves the finished call and tells every member (each sees it from their own
// point of view: outgoing, incoming, missed...) so the calls page updates live.
async function logCallEnded(io, call, reason) {
    if (!call.logId) return;

    try {
        const endedAt = new Date();
        const durationSeconds = call.answeredAt
            ? Math.max(0, Math.round((endedAt - call.answeredAt) / 1000))
            : 0;

        const log = await Call.findByIdAndUpdate(
            call.logId,
            {
                endedAt,
                durationSeconds,
                answeredAt: call.answeredAt || null,
                endReason: reason,
                joined: [...call.joinedSet],
                declinedBy: [...call.declinedSet],
            },
            { new: true }
        ).populate(CALL_POPULATE);

        if (!log) return;

        call.members.forEach((memberId) => {
            io.to(personalRoom(memberId)).emit("calls:new", {
                call: serializeCall(log, memberId),
            });
        });
    } catch (err) {
        console.error("Could not save the call log", err);
    }
}


export default function registerCallHandlers(io, socket) {
    // ASSUMPTION: your auth middleware sets socket.userId. Change if it differs.
    const userId = String(socket.data.userId);
    socket.join(personalRoom(userId));

    function leaveCall() {
        const conversationId = userCalls.get(userId);
        const call = calls.get(conversationId);
        if (!call || call.participants.get(userId) !== socket.id) return;

        call.participants.delete(userId);
        userCalls.delete(userId);

        // 1-to-1: any hang-up ends it. Group: ends when the last person leaves.
        if (!call.isGroup || call.participants.size === 0) {
            return endCall(io, call, "hangup");
        }
        call.participants.forEach((sid) =>
            io.to(sid).emit("call:user-left", { conversationId, userId })
        );
    }

    socket.on("call:start", async ({ conversationId, type }, ack) => {
        try {

            if (!mongoose.isValidObjectId(conversationId)) {
                return ack?.({ ok: false, error: "Invalid conversation." });
            }
            if (!["audio", "video"].includes(type)) {
                return ack?.({ ok: false, error: "Invalid call type." });
            }
            if (userCalls.has(userId)) {
                return ack?.({ ok: false, error: "You are already in a call." });
            }

            // ASSUMPTION: Conversation has `participants` (array of user ids).
            const conversation = await Conversation.findById(conversationId).lean();
            const members = (conversation?.participants ?? []).map(String);
            if (!members.includes(userId)) {
                return ack?.({ ok: false, error: "You are not in this conversation." });
            }
            if (calls.has(conversationId)) {
                return ack?.({ ok: false, error: "A call is already in progress here." });
            }
            if (userCalls.has(userId)) {
                return ack?.({ ok: false, error: "You are already in a call." });
            }

            const isGroup = conversation.type === "group";
            const invitees = members.filter((id) => id !== userId);
            const free = invitees.filter((id) => !userCalls.has(id));

            if (!isGroup && free.length === 0) {
                return ack?.({ ok: false, error: "User is busy on another call." });
            }

            const call = {
                conversationId,
                type,
                isGroup,
                initiator: userId,
                members: new Set(members),
                participants: new Map([[userId, socket.id]]), // userId -> socketId
                timer: null,
                // Call history bookkeeping
                logId: null,
                answeredAt: null,
                joinedSet: new Set(),
                declinedSet: new Set(),
            };
            calls.set(conversationId, call);
            userCalls.set(userId, conversationId);

            
            // Create the history entry. If this fails the call still works,
            // it just won't appear in the call history.
            try {
                const log = await Call.create({
                    conversation: conversationId,
                    caller: userId,
                    type,
                    isGroup,
                    invited: invitees,
                });
                call.logId = log._id;
            } catch (logError) {
                console.error("Could not create the call log", logError);
            }


            call.timer = setTimeout(() => {
                if (call.participants.size <= 1) endCall(io, call, "no-answer");
            }, RING_TIMEOUT_MS);

            free.forEach((id) =>
                io.to(personalRoom(id)).emit("call:incoming", {
                    conversationId, type, isGroup, from: userId,
                })
            );

            ack?.({ ok: true, call: { conversationId, type, isGroup } });
        } catch (err) {
            console.error("call:start error", err);
            ack?.({ ok: false, error: "Could not start the call." });
        }
    });

    socket.on("call:join", ({ conversationId }, ack) => {
        const call = calls.get(conversationId);
        if (!call) return ack?.({ ok: false, error: "This call has ended." });
        if (!call.members.has(userId)) return ack?.({ ok: false, error: "Not allowed." });
        if (userCalls.has(userId)) return ack?.({ ok: false, error: "Already in a call." });
        if (call.participants.size >= MAX_PARTICIPANTS) {
            return ack?.({ ok: false, error: "This call is full." });
        }

        const existing = [...call.participants.keys()];
        call.participants.set(userId, socket.id);
        userCalls.set(userId, conversationId);
        clearTimeout(call.timer);

        
        call.joinedSet.add(userId);
        if (!call.answeredAt) call.answeredAt = new Date();


        existing.forEach((uid) =>
            io.to(call.participants.get(uid)).emit("call:user-joined", { conversationId, userId })
        );

        // Stop ringing on this user's other devices
        socket.to(personalRoom(userId)).emit("call:ended", {
            conversationId, reason: "answered-elsewhere",
        });

        ack?.({ ok: true, type: call.type, participants: existing });
    });

    socket.on("call:reject", ({ conversationId }) => {
        const call = calls.get(conversationId);
        if (!call || call.participants.has(userId) || !call.members.has(userId)) return;
                if (!call || call.participants.has(userId) || !call.members.has(userId)) return;

        call.declinedSet.add(userId);

        if (!call.isGroup) endCall(io, call, "rejected");
    });

    // Relays SDP offers/answers and ICE candidates between two participants
    socket.on("call:signal", ({ conversationId, to, data }) => {
        const call = calls.get(conversationId);
        if (!call || call.participants.get(userId) !== socket.id) return;
        const targetSocket = call.participants.get(String(to));
        if (targetSocket) {
            io.to(targetSocket).emit("call:signal", { conversationId, from: userId, data });
        }
    });

    socket.on("call:leave", leaveCall);
    socket.on("disconnect", leaveCall);
}