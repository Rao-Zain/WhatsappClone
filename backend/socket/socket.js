import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import registerCallHandlers from "./callHandlers.js";
import {
  REPLY_POPULATE,
  resolveReplyTarget,
  serializeMessage,
} from "../utils/serializeMessage.js";

import { hasOnlineRecipient } from "../utils/messageDelivery.js";
import { getBlockedMessage } from "../utils/blocks.js";
// userId -> Set of socket IDs (a user can have several tabs/devices open)
const onlineUsers = new Map();

// userId -> timeout. While a timer is pending the user is still treated as
// online, which stops the status flickering on page refresh or brief drops.
const offlineTimers = new Map();

const PRESENCE_GRACE_MS = 0;

/* ------------------------------------------------------------------ */
/* Presence helpers                                                    */
/* ------------------------------------------------------------------ */

// Call once after MongoDB connects. A crash or restart can leave users
// stuck as "online" in the database, so reset them.
export async function resetPresence() {
  await User.updateMany(
    { isOnline: true },
    { $set: { isOnline: false, lastSeen: new Date() } }
  );
}

function isUserOnline(userId) {
  return onlineUsers.has(userId) || offlineTimers.has(userId);
}

// IDs of everyone who shares a conversation with this user.
async function getContactIds(userId) {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .select("participants")
    .lean();

  const ids = new Set();

  for (const conversation of conversations) {
    for (const participant of conversation.participants) {
      const id = String(participant);
      if (id !== userId) ids.add(id);
    }
  }

  return [...ids];
}

// Send an event only to the given users' private rooms.
function emitToUsers(io, userIds, event, payload) {
  if (!userIds.length) return;

  io.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
}

// Tell every contact (and the user's own other tabs) that a profile changed.
// Only whitelisted public fields are ever sent.
const PUBLIC_PROFILE_FIELDS = ["name", "username", "about", "profilePicture"];

export async function broadcastProfileUpdate(io, userId, changes) {
  try {
    if (!io || !changes) return;

    const id = String(userId);
    const payload = { userId: id };

    for (const field of PUBLIC_PROFILE_FIELDS) {
      if (changes[field] !== undefined) payload[field] = changes[field];
    }

    // Nothing public changed.
    if (Object.keys(payload).length === 1) return;

    const contactIds = await getContactIds(id);

    emitToUsers(io, [...contactIds, id], "user:updated", payload);
  } catch (error) {
    console.error("Profile broadcast error:", error.message);
  }
}

async function markPendingMessagesDelivered(io, userId) {
  try {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .select("_id participants")
      .lean();

    for (const conversation of conversations) {
      const pendingMessages = await Message.find({
        conversation: conversation._id,
        sender: { $ne: userId },
        status: "sent",
        readBy: { $ne: userId },
      })
        .select("_id sender")
        .lean();

      if (!pendingMessages.length) continue;

      await Message.updateMany(
        {
          _id: { $in: pendingMessages.map((message) => message._id) },
          status: "sent",
          readBy: { $ne: userId },
        },
        { $set: { status: "delivered" } }
      );

      const messagesBySender = new Map();
      for (const message of pendingMessages) {
        const senderId = String(message.sender);
        const messageIds = messagesBySender.get(senderId) || [];
        messageIds.push(String(message._id));
        messagesBySender.set(senderId, messageIds);
      }

      for (const [senderId, messageIds] of messagesBySender) {
        io.to(`user:${senderId}`).emit("messages:delivered", {
          conversationId: String(conversation._id),
          messageIds,
          deliveredBy: userId,
        });
      }
    }
  } catch (error) {
    console.error("Failed to mark pending messages delivered:", error);
  }
}

async function announcePresence(io, socket, userId, becameOnline) {
  try {
    const contactIds = await getContactIds(userId);

    // One snapshot per connection: current status of every contact.
    // Online state comes from memory; lastSeen from one DB query.
    const contacts = contactIds.length
      ? await User.find({ _id: { $in: contactIds } })
          .select("lastSeen")
          .lean()
      : [];

    socket.emit(
      "presence:snapshot",
      contacts.map((contact) => {
        const id = String(contact._id);

        return {
          userId: id,
          isOnline: isUserOnline(id),
          lastSeen: contact.lastSeen,
        };
      })
    );

    // Only the first connection (offline -> online) is announced.
    if (becameOnline) {
      await User.findByIdAndUpdate(userId, { isOnline: true });

      emitToUsers(io, contactIds, "presence:update", {
        userId,
        isOnline: true,
      });
    }
  } catch (error) {
    console.error("Presence announce error:", error.message);
  }
}

async function markOffline(io, userId) {
  offlineTimers.delete(userId);

  // The user came back during the grace period.
  if (onlineUsers.has(userId)) return;

  try {
    const lastSeen = new Date();

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen,
    });

    // They may have reconnected while the write was in flight.
    if (onlineUsers.has(userId)) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      return;
    }

    const contactIds = await getContactIds(userId);

    emitToUsers(io, contactIds, "presence:update", {
      userId,
      isOnline: false,
      lastSeen,
    });
  } catch (error) {
    console.error("Failed to update offline status:", error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Socket server                                                       */
/* ------------------------------------------------------------------ */

export default function initializeSocket(io) {
  // Authenticate every socket connection using the JWT token.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication token is required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const userId = decoded.id || decoded.userId || decoded._id;

      if (!userId || !mongoose.isValidObjectId(userId)) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.userId = userId;

      next();
    } catch (error) {
      next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    
    const userId = String(socket.data.userId);

    console.log(`User connected: ${userId}`);

    // Join this user's private room.
    socket.join(`user:${userId}`);

    // ---- Presence bookkeeping (synchronous, before any await) ----
    const pendingTimer = offlineTimers.get(userId);

    if (pendingTimer) {
      clearTimeout(pendingTimer);
      offlineTimers.delete(userId);
    }

    const userSockets = onlineUsers.get(userId) || new Set();
    const becameOnline = userSockets.size === 0 && !pendingTimer;

    userSockets.add(socket.id);
    onlineUsers.set(userId, userSockets);

    // --------------------------------------------------
    // REAL-TIME MESSAGE HANDLER
    // --------------------------------------------------

    socket.on("message:send", async (payload, acknowledge) => {
      const reply =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { conversationId, text, replyTo } = payload || {};

        if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
          return reply({
            success: false,
            message: "Invalid conversation ID",
          });
        }

        if (typeof text !== "string" || !text.trim()) {
          return reply({
            success: false,
            message: "Message text cannot be empty",
          });
        }

        const trimmedText = text.trim();

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          return reply({
            success: false,
            message: "Conversation not found",
          });
        }

        const isParticipant = conversation.participants.some(
          (participantId) => String(participantId) === userId
        );

        if (!isParticipant) {
          return reply({
            success: false,
            message: "You are not a participant in this conversation",
          });
        }
        const blockedMessage = await getBlockedMessage(conversation, userId);

        if (blockedMessage) {
          return reply({
            success: false,
            message: blockedMessage,
          });
        }


        // Only accept a reply target from this same conversation.
        const replyToId = await resolveReplyTarget(
          replyTo,
          conversation._id
        );

        const message = await Message.create({
          conversation: conversation._id,
          sender: userId,
          text: trimmedText,
          type: "text",
          status: hasOnlineRecipient(io, conversation, userId)
            ? "delivered"
            : "sent",
          readBy: [userId],
          replyTo: replyToId,
        });

        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();

        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "username name profilePicture")
          .populate(REPLY_POPULATE);

        const messagePayload = serializeMessage(populatedMessage);

        for (const participantId of conversation.participants) {
          io.to(`user:${String(participantId)}`).emit(
            "message:new",
            messagePayload
          );
        }

        reply({
          success: true,
          message: messagePayload,
        });
      } catch (error) {
        console.error("Socket message error:", error);

        reply({
          success: false,
          message: "Failed to send message",
        });
      }
    });

    socket.on("conversation:read:notify", async (payload) => {
      try {
        const { conversationId } = payload || {};

        if (!mongoose.isValidObjectId(conversationId)) return;

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        }).select("_id participants");

        if (!conversation) return;

        for (const participantId of conversation.participants) {
          if (String(participantId) === userId) continue;

          io.to(`user:${String(participantId)}`).emit("messages:read", {
            conversationId: String(conversation._id),
            readBy: userId,
          });
        }
      } catch (error) {
        console.error("Read receipt notification error:", error);
      }
    });


        // --------------------------------------------------
    // TYPING INDICATOR
    // Client sends { conversationId, isTyping }. Nothing is stored;
    // it is only passed on to the other people in the chat.
    // --------------------------------------------------

    socket.on("typing", async (payload) => {
      try {
        const { conversationId, isTyping } = payload || {};

        if (!mongoose.isValidObjectId(conversationId)) return;

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        }).select("_id type participants");

        if (!conversation) return;

        // A blocked person (or the blocker) never sees typing.
        if (await getBlockedMessage(conversation, userId)) return;

        // The name is looked up once per connection.
        if (socket.data.typingName === undefined) {
          const me = await User.findById(userId).select("name username").lean();
          socket.data.typingName = me?.name?.trim() || me?.username || "";
        }

        for (const participantId of conversation.participants) {
          if (String(participantId) === userId) continue;

          io.to(`user:${String(participantId)}`).emit("typing:update", {
            conversationId: String(conversation._id),
            userId,
            name: socket.data.typingName,
            isTyping: Boolean(isTyping),
          });
        }
      } catch (error) {
        console.error("Typing indicator error:", error.message);
      }
    });

    // --------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${userId}`);

      const sockets = onlineUsers.get(userId);

      if (!sockets) return;

      sockets.delete(socket.id);

      // Other tabs/devices still connected: the user stays online.
      if (sockets.size > 0) return;

      onlineUsers.delete(userId);

      // Wait before marking offline so a quick reconnect cancels it.
      offlineTimers.set(
        userId,
        setTimeout(() => markOffline(io, userId), PRESENCE_GRACE_MS)
      );
    });
registerCallHandlers(io, socket);
    // Handlers above are registered first so no early event is lost
    // while the presence queries run.
    announcePresence(io, socket, userId, becameOnline);
    markPendingMessagesDelivered(io, userId);
  });
}