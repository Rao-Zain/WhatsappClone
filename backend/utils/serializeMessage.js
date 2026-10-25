import mongoose from "mongoose";
import Message from "../models/Message.js";

// Populate options for the quoted message shown inside a reply.
export const REPLY_POPULATE = {
  path: "replyTo",
  select: "sender text type deletedForEveryone",
  populate: { path: "sender", select: "username name" },
};

function serializeUser(user) {
  if (!user) return null;

  if (typeof user === "object" && user.username !== undefined) {
    return {
      _id: String(user._id),
      username: user.username,
      name: user.name || "",
      profilePicture: user.profilePicture || "",
    };
  }

  return String(user._id || user);
}

function serializeReply(reply) {
  if (!reply || typeof reply !== "object" || reply.type === undefined) {
    return null;
  }

  const deleted = Boolean(reply.deletedForEveryone);

  return {
    _id: String(reply._id),
    sender: serializeUser(reply.sender),
    text: deleted ? "" : reply.text || "",
    type: reply.type,
    deletedForEveryone: deleted,
  };
}

/**
 * One public shape for every message sent to the client (REST and sockets).
 * Never exposes storage keys or the raw starredBy / deletedFor lists.
 * `viewerId` only affects the private `starred` flag.
 */
export function serializeMessage(message, viewerId = null) {
  const m = typeof message.toObject === "function" ? message.toObject() : message;

  const id = String(m._id);
  const conversationId = String(m.conversation?._id || m.conversation);
  const deleted = Boolean(m.deletedForEveryone);

  return {
    _id: id,
    conversation: conversationId,
    sender: serializeUser(m.sender),
    text: deleted ? "" : m.text || "",
    type: m.type,
    status: m.status,
    createdAt: m.createdAt,
    forwarded: deleted ? false : Boolean(m.forwarded),
        editedAt: deleted ? null : m.editedAt || null,
    deletedForEveryone: deleted,
    starred: viewerId
      ? (m.starredBy || []).some((u) => String(u) === String(viewerId))
      : false,
    reactions: deleted
      ? []
      : (m.reactions || []).map((r) => ({
          userId: String(r.user),
          emoji: r.emoji,
        })),
    replyTo: deleted ? null : serializeReply(m.replyTo),
    attachments: deleted
      ? []
      : (m.attachments || []).map((file, index) => ({
          _id: String(file._id),
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          downloadUrl: `/conversations/${conversationId}/messages/${id}/attachments/${index}`,
        })),
  };
}

// Returns the message id only if it exists in the same conversation.
export async function resolveReplyTarget(replyTo, conversationId) {
  if (!replyTo || !mongoose.isValidObjectId(replyTo)) return null;

 const target = await Message.findOne({
    _id: replyTo,
    conversation: conversationId,
    type: { $ne: "system" },
  }).select("_id");

  return target ? target._id : null;
}