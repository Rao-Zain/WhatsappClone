import crypto from "crypto";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { REPLY_POPULATE, serializeMessage } from "../utils/serializeMessage.js";
import { hasOnlineRecipient } from "../utils/messageDelivery.js";

const uploadDirectory = path.resolve("uploads/attachments");

// Keep in sync with DELETE_FOR_EVERYONE_WINDOW_MS in ChatWindow.jsx.
const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_FORWARD_TARGETS = 5;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function storagePath(storageKey) {
  if (!storageKey) return null;

  const filePath = path.resolve(uploadDirectory, storageKey);

  return filePath.startsWith(uploadDirectory + path.sep) ? filePath : null;
}

function removeFiles(paths) {
  return Promise.all(
    paths.map((p) => fs.promises.unlink(p).catch(() => {}))
  );
}

function emitToParticipants(req, conversation, event, payload) {
  const io = req.app.get("io");

  for (const participantId of conversation.participants) {
    io?.to(`user:${String(participantId)}`).emit(event, payload);
  }
}

// Validates IDs, membership, and that the message is visible to this user.
async function loadMessageContext(req, res) {
  const { conversationId, messageId } = req.params;

  if (
    !mongoose.isValidObjectId(conversationId) ||
    !mongoose.isValidObjectId(messageId)
  ) {
    fail(res, 400, "Invalid conversation or message ID.");
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: req.user._id,
  });

  if (!conversation) {
    fail(res, 404, "Conversation not found.");
    return null;
  }

  const message = await Message.findOne({
    _id: messageId,
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
  });

  if (!message) {
    fail(res, 404, "Message not found.");
    return null;
  }

  return { conversation, message };
}

// PUT /api/conversations/:conversationId/messages/:messageId/reaction
// Body: { emoji } - one reaction per user; an empty emoji removes it.
export async function reactToMessage(req, res) {
  try {
    const ctx = await loadMessageContext(req, res);
    if (!ctx) return;

    const { conversation, message } = ctx;

    if (message.deletedForEveryone) {
      return fail(res, 400, "You can't react to a deleted message.");
    }

    const emoji =
      typeof req.body?.emoji === "string" ? req.body.emoji.trim() : "";

    if (emoji && (Array.from(emoji).length > 12 || /\s/.test(emoji))) {
      return fail(res, 400, "Invalid reaction.");
    }

    await Message.updateOne(
      { _id: message._id },
      { $pull: { reactions: { user: req.user._id } } }
    );

    if (emoji) {
      await Message.updateOne(
        { _id: message._id },
        { $push: { reactions: { user: req.user._id, emoji } } }
      );
    }

    const updated = await Message.findById(message._id).select("reactions");

    const reactions = (updated?.reactions || []).map((r) => ({
      userId: String(r.user),
      emoji: r.emoji,
    }));

    emitToParticipants(req, conversation, "message:reaction", {
      conversationId: String(conversation._id),
      messageId: String(message._id),
      reactions,
    });

    return res.status(200).json({ success: true, reactions });
  } catch (error) {
    console.error("React to message error:", error);
    return fail(res, 500, "Unable to react to this message.");
  }
}

// POST /api/conversations/:conversationId/messages/:messageId/star
// Stars are private to each user, so nothing is broadcast.
export async function toggleStarMessage(req, res) {
  try {
    const ctx = await loadMessageContext(req, res);
    if (!ctx) return;

    const { message } = ctx;

    if (message.deletedForEveryone) {
      return fail(res, 400, "You can't star a deleted message.");
    }

    const isStarred = (message.starredBy || []).some(
      (id) => String(id) === String(req.user._id)
    );

    await Message.updateOne(
      { _id: message._id },
      isStarred
        ? { $pull: { starredBy: req.user._id } }
        : { $addToSet: { starredBy: req.user._id } }
    );

    return res.status(200).json({ success: true, starred: !isStarred });
  } catch (error) {
    console.error("Star message error:", error);
    return fail(res, 500, "Unable to update this message.");
  }
}

// DELETE /api/conversations/:conversationId/messages/:messageId?scope=me|everyone
export async function deleteMessage(req, res) {
  try {
    const ctx = await loadMessageContext(req, res);
    if (!ctx) return;

    const { conversation, message } = ctx;

    const scope = req.query.scope === "everyone" ? "everyone" : "me";
    const conversationId = String(conversation._id);
    const messageId = String(message._id);

    if (scope === "me") {
      await Message.updateOne(
        { _id: message._id },
        { $addToSet: { deletedFor: req.user._id } }
      );

      return res.status(200).json({ success: true, scope, messageId });
    }

    if (String(message.sender) !== String(req.user._id)) {
      return fail(res, 403, "You can only delete your own messages for everyone.");
    }

    if (message.deletedForEveryone) {
      return res.status(200).json({ success: true, scope, messageId });
    }

    const age = Date.now() - new Date(message.createdAt).getTime();

    if (age > DELETE_FOR_EVERYONE_WINDOW_MS) {
      return fail(res, 403, "This message is too old to delete for everyone.");
    }

    const withFiles = await Message.findById(message._id).select(
      "+attachments.storageKey"
    );

    const filePaths = (withFiles?.attachments || [])
      .map((file) => storagePath(file.storageKey))
      .filter(Boolean);

    await Message.updateOne(
      { _id: message._id },
      {
        $set: {
          deletedForEveryone: true,
          text: "",
          attachments: [],
          reactions: [],
          starredBy: [],
          forwarded: false,
          replyTo: null,
        },
      }
    );

    await removeFiles(filePaths);

    emitToParticipants(req, conversation, "message:deleted", {
      conversationId,
      messageId,
      isLastMessage: String(conversation.lastMessage) === messageId,
    });

    return res.status(200).json({ success: true, scope, messageId });
  } catch (error) {
    console.error("Delete message error:", error);
    return fail(res, 500, "Unable to delete this message.");
  }
}

// Copies attachment files so deleting the original never breaks a forward.
async function copyAttachments(attachments) {
  const copied = [];
  const created = [];

  try {
    for (const file of attachments) {
      const source = storagePath(file.storageKey);

      if (!source) throw new Error("Invalid attachment path.");

      const storageKey = `${Date.now()}-${crypto.randomUUID()}${path.extname(
        file.storageKey
      )}`;
      const destination = path.join(uploadDirectory, storageKey);

      await fs.promises.copyFile(source, destination);
      created.push(destination);

      copied.push({
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        storageKey,
      });
    }

    return { copied, created };
  } catch (error) {
    await removeFiles(created);
    throw error;
  }
}

// POST /api/conversations/:conversationId/messages/:messageId/forward
// Body: { conversationIds: [id, ...] } (max 5)
export async function forwardMessage(req, res) {
  try {
    const ctx = await loadMessageContext(req, res);
    if (!ctx) return;

    const { message } = ctx;

    if (message.deletedForEveryone) {
      return fail(res, 400, "You can't forward a deleted message.");
    }

    const rawIds = Array.isArray(req.body?.conversationIds)
      ? req.body.conversationIds
      : [];

    const conversationIds = [...new Set(rawIds.map(String))];

    if (
      conversationIds.length === 0 ||
      conversationIds.length > MAX_FORWARD_TARGETS ||
      !conversationIds.every((id) => mongoose.isValidObjectId(id))
    ) {
      return fail(
        res,
        400,
        `Choose between 1 and ${MAX_FORWARD_TARGETS} chats to forward to.`
      );
    }

    const targets = await Conversation.find({
      _id: { $in: conversationIds },
      participants: req.user._id,
    });

    if (targets.length !== conversationIds.length) {
      return fail(res, 404, "One or more chats were not found.");
    }

    const original = await Message.findById(message._id).select(
      "+attachments.storageKey"
    );

    let forwardedCount = 0;

    for (const target of targets) {
      const { copied, created } = await copyAttachments(
        original.attachments || []
      );

      try {
        const doc = new Message({
          conversation: target._id,
          sender: req.user._id,
          text: original.text,
          type: original.type,
          attachments: copied,
          forwarded: true,
          status: hasOnlineRecipient(
            req.app.get("io"),
            target,
            req.user._id
          )
            ? "delivered"
            : "sent",
          readBy: [req.user._id],
        });

        doc.attachments.forEach((file, index) => {
          file.url = `/conversations/${target._id}/messages/${doc._id}/attachments/${index}`;
        });

        await doc.save();

        target.lastMessage = doc._id;
        target.updatedAt = new Date();
        await target.save();

        const populated = await Message.findById(doc._id)
          .populate("sender", "username name profilePicture")
          .populate(REPLY_POPULATE);

        emitToParticipants(req, target, "message:new", serializeMessage(populated));

        forwardedCount += 1;
      } catch (error) {
        await removeFiles(created);
        throw error;
      }
    }

    return res.status(200).json({ success: true, forwarded: forwardedCount });
  } catch (error) {
    console.error("Forward message error:", error);
    return fail(res, 500, "Unable to forward this message.");
  }
}