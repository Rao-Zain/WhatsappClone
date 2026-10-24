import mongoose from "mongoose";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import ChatRequest from "../models/ChatRequest.js";
import Block from "../models/Block.js";
import PinAttempt from "../models/PinAttempt.js";
import { PIN_REGEX, pinsMatch } from "../utils/chatPin.js";
import { getBlockState } from "../utils/blocks.js";

const PARTICIPANT_FIELDS = "name username profilePicture about isOnline lastSeen";
const REQUEST_USER_FIELDS = "name username profilePicture about";

// Wrong-PIN limits (per requesting account).
const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

const room = (userId) => `user:${String(userId)}`;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* PIN guess limiting                                                  */
/* ------------------------------------------------------------------ */

async function getPinLockMinutes(userId) {
  const attempt = await PinAttempt.findOne({ user: userId }).lean();

  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    return Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60000);
  }

  return 0;
}

async function recordPinFailure(userId) {
  const now = Date.now();
  let attempt = await PinAttempt.findOne({ user: userId });

  if (!attempt) {
    attempt = new PinAttempt({ user: userId });
  } else if (now - attempt.updatedAt.getTime() > PIN_LOCK_MS) {
    // Old failures expire.
    attempt.failures = 0;
    attempt.lockedUntil = null;
  }

  attempt.failures += 1;

  if (attempt.failures >= MAX_PIN_FAILURES) {
    attempt.lockedUntil = new Date(now + PIN_LOCK_MS);
    attempt.failures = 0;
  }

  await attempt.save();
}

/* ------------------------------------------------------------------ */
/* Serializers                                                         */
/* ------------------------------------------------------------------ */

function serializeRequest(request, otherUser) {
  return {
    id: String(request._id),
    status: request.status,
    via: request.via,
    createdAt: request.createdAt,
    respondedAt: request.respondedAt,
    user: {
      _id: String(otherUser._id),
      name: otherUser.name || "",
      username: otherUser.username,
      profilePicture: otherUser.profilePicture || "",
      about: otherUser.about || "",
    },
  };
}

async function loadConversation(conversationId) {
  return Conversation.findById(conversationId)
    .populate("participants", PARTICIPANT_FIELDS)
    .populate("lastMessage");
}

// Finds (or creates) the one private conversation between two users.
async function findOrCreatePrivateConversation(userAId, userBId) {
  let conversation = await Conversation.findOne({
    type: "private",
    participants: { $all: [userAId, userBId], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      type: "private",
      participants: [userAId, userBId],
    });
  }

  return conversation._id;
}

// Marks a request accepted, opens the chat and tells both people.
async function acceptRequest(req, request) {
  request.status = "accepted";
  request.respondedAt = new Date();
  await request.save();

  const conversationId = await findOrCreatePrivateConversation(
    request.from,
    request.to
  );

  const conversation = await loadConversation(conversationId);
  const io = req.app.get("io");
  const payload = {
    ...conversation.toObject(),
    unreadCount: 0,
    blockedByMe: false,
    blockedByOther: false,
  };

  io?.to(room(request.from)).emit("conversation:new", payload);
  io?.to(room(request.to)).emit("conversation:new", payload);

  const update = { id: String(request._id), status: "accepted" };
  io?.to(room(request.from)).emit("chat-request:updated", update);
  io?.to(room(request.to)).emit("chat-request:updated", update);

  return conversation;
}

/* ------------------------------------------------------------------ */
/* POST /api/chat-requests                                             */
/* Body: { phone }  OR  { username, pin }                              */
/* ------------------------------------------------------------------ */

export async function sendChatRequest(req, res) {
  try {
    const me = req.user;
    const phone =
      typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";

    let target = null;
    let via = "";

    if (phone) {
      const digitCount = phone.replace(/\D/g, "").length;

      if (digitCount < 7 || digitCount > 15) {
        return fail(res, 400, "Enter a valid phone number.");
      }

      target = await User.findOne({ phone, emailVerified: true }).select(
        "_id name username profilePicture about"
      );

      if (!target) {
        return fail(res, 404, "No account found for this phone number.");
      }

      via = "phone";
    } else if (username) {
      if (!PIN_REGEX.test(pin)) {
        return fail(res, 400, "Enter the 4-digit PIN.");
      }

      const lockMinutes = await getPinLockMinutes(me._id);

      if (lockMinutes > 0) {
        return fail(
          res,
          429,
          `Too many incorrect attempts. Try again in ${lockMinutes} minute${lockMinutes === 1 ? "" : "s"}.`
        );
      }

      // lean(): the stored PIN is compared as-is. Accounts that have no PIN
      // yet (created before this feature) simply never match.
      const candidate = await User.findOne({
        username: { $regex: `^${escapeRegExp(username)}$`, $options: "i" },
        emailVerified: true,
      })
        .select("_id name username profilePicture about +chatPin")
        .lean();

      // One generic message for "no such user" and "wrong PIN", so this
      // endpoint cannot be used to find out which usernames exist.
      if (!candidate || !pinsMatch(candidate.chatPin, pin)) {
        await recordPinFailure(me._id);
        return fail(res, 400, "Username or PIN is incorrect.");
      }

      await PinAttempt.deleteOne({ user: me._id });

      target = candidate;
      via = "pin";
    } else {
      return fail(res, 400, "Enter a phone number, or a username and PIN.");
    }

    if (String(target._id) === String(me._id)) {
      return fail(res, 400, "You cannot start a chat with yourself.");
    }

    // ---- Blocks ----
    const { blockedByMe, blockedByOther } = await getBlockState(
      me._id,
      target._id
    );

    if (blockedByMe) {
      return fail(
        res,
        403,
        "You blocked this user. Unblock them first to send a request."
      );
    }

    if (blockedByOther) {
      return fail(res, 403, "You can't send a chat request to this user.");
    }

    // ---- Already chatting: just open the chat ----
    const existing = await Conversation.findOne({
      type: "private",
      participants: { $all: [me._id, target._id], $size: 2 },
    }).select("_id");

    if (existing) {
      return res.status(200).json({
        success: true,
        status: "connected",
        conversation: await loadConversation(existing._id),
      });
    }

    const io = req.app.get("io");

    // ---- They already asked ME: sending a request back means "accept" ----
    const reverse = await ChatRequest.findOne({
      from: target._id,
      to: me._id,
      status: "pending",
    });

    if (reverse) {
      const conversation = await acceptRequest(req, reverse);

      return res.status(200).json({
        success: true,
        status: "connected",
        conversation,
      });
    }

    // ---- Create (or re-open) my request ----
    let request = await ChatRequest.findOne({ from: me._id, to: target._id });

    if (request?.status === "pending") {
      return fail(res, 409, "You already sent this user a chat request.");
    }

    if (request) {
      request.status = "pending";
      request.via = via;
      request.respondedAt = null;
      await request.save();
    } else {
      request = await ChatRequest.create({
        from: me._id,
        to: target._id,
        via,
      });
    }

    // Show it to the receiver right away (incoming) and to my other tabs (outgoing).
    io?.to(room(target._id)).emit("chat-request:new", {
      direction: "incoming",
      request: serializeRequest(request, me),
    });
    io?.to(room(me._id)).emit("chat-request:new", {
      direction: "outgoing",
      request: serializeRequest(request, target),
    });

    return res.status(201).json({
      success: true,
      status: "pending",
      request: serializeRequest(request, target),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return fail(res, 409, "You already sent this user a chat request.");
    }

    console.error("Send chat request error:", error);
    return fail(res, 500, "Unable to send the chat request.");
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/chat-requests                                              */
/* ------------------------------------------------------------------ */

export async function getChatRequests(req, res) {
  try {
    const meId = req.user._id;
    const recentlyDeclined = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [incoming, outgoing] = await Promise.all([
      ChatRequest.find({ to: meId, status: "pending" })
        .populate("from", REQUEST_USER_FIELDS)
        .sort({ createdAt: -1 })
        .limit(100),
      ChatRequest.find({
        from: meId,
        $or: [
          { status: "pending" },
          { status: "rejected", respondedAt: { $gte: recentlyDeclined } },
        ],
      })
        .populate("to", REQUEST_USER_FIELDS)
        .sort({ updatedAt: -1 })
        .limit(100),
    ]);

    return res.status(200).json({
      success: true,
      incoming: incoming
        .filter((request) => request.from)
        .map((request) => serializeRequest(request, request.from)),
      outgoing: outgoing
        .filter((request) => request.to)
        .map((request) => serializeRequest(request, request.to)),
    });
  } catch (error) {
    console.error("Get chat requests error:", error);
    return fail(res, 500, "Unable to load chat requests.");
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/chat-requests/:requestId/respond   { action }             */
/* ------------------------------------------------------------------ */

export async function respondToChatRequest(req, res) {
  try {
    const { requestId } = req.params;
    const action = req.body?.action;

    if (!mongoose.isValidObjectId(requestId)) {
      return fail(res, 400, "Invalid request ID.");
    }

    if (action !== "accept" && action !== "reject") {
      return fail(res, 400, 'Action must be "accept" or "reject".');
    }

    // Only the receiver can answer, and only while it is pending.
    const request = await ChatRequest.findOne({
      _id: requestId,
      to: req.user._id,
      status: "pending",
    });

    if (!request) {
      return fail(res, 404, "This chat request is no longer available.");
    }

    const io = req.app.get("io");

    if (action === "accept") {
      const conversation = await acceptRequest(req, request);

      return res.status(200).json({
        success: true,
        status: "accepted",
        conversation,
      });
    }

    // Reject: the sender is blocked from messaging the receiver.
    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();

    await Block.updateOne(
      { blocker: request.to, blocked: request.from },
      { $setOnInsert: { reason: "rejected-request" } },
      { upsert: true }
    );

    const update = { id: String(request._id), status: "rejected" };
    io?.to(room(request.from)).emit("chat-request:updated", update);
    io?.to(room(request.to)).emit("chat-request:updated", update);

    return res.status(200).json({ success: true, status: "rejected" });
  } catch (error) {
    console.error("Respond to chat request error:", error);
    return fail(res, 500, "Unable to answer this chat request.");
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/chat-requests/:requestId   (sender cancels)             */
/* ------------------------------------------------------------------ */

export async function cancelChatRequest(req, res) {
  try {
    const { requestId } = req.params;

    if (!mongoose.isValidObjectId(requestId)) {
      return fail(res, 400, "Invalid request ID.");
    }

    const request = await ChatRequest.findOneAndDelete({
      _id: requestId,
      from: req.user._id,
      status: "pending",
    });

    if (!request) {
      return fail(res, 404, "This chat request is no longer available.");
    }

    const io = req.app.get("io");
    const payload = { id: String(request._id) };

    io?.to(room(request.from)).emit("chat-request:removed", payload);
    io?.to(room(request.to)).emit("chat-request:removed", payload);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Cancel chat request error:", error);
    return fail(res, 500, "Unable to cancel the chat request.");
  }
}