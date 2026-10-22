import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { REPLY_POPULATE, resolveReplyTarget, serializeMessage } from "../utils/serializeMessage.js";
import { hasOnlineRecipient } from "../utils/messageDelivery.js";
import fs from "fs";
import path from "path";


// POST /api/conversations
export async function createConversation(req, res) {
  try {
    const { participantId } = req.body;
    const currentUserId = req.user._id;

    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({
        success: false,
        message: "A valid participant ID is required.",
      });
    }

    if (participantId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a conversation with yourself.",
      });
    }

    const otherUser = await User.findById(participantId).select("_id");

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Reuse an existing private conversation if one exists.
    let conversation = await Conversation.findOne({
      type: "private",
      participants: {
        $all: [currentUserId, otherUser._id],
        $size: 2,
      },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "private",
        participants: [currentUserId, otherUser._id],
      });
    }

 conversation = await Conversation.findById(conversation._id)
  .populate(
    "participants",
    "name username profilePicture about isOnline lastSeen"
  )
  .populate("lastMessage");

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create conversation.",
    });
  }
}


 // GET /api/conversations/search-users?phone=...
export async function searchUsersByPhone(req, res) {
  try {
    const phone =
      typeof req.query.phone === "string"
        ? req.query.phone.trim()
        : "";

    const digitCount = phone.replace(/\D/g, "").length;

    if (!phone || digitCount < 7 || digitCount > 15) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number.",
      });
    }

    const user = await User.findOne({
      phone,
      _id: { $ne: req.user._id },
      emailVerified: true,
    }).select("_id username phone profilePicture about");

    return res.status(200).json({
      success: true,
      users: user ? [user] : [],
    });
  } catch (error) {
    console.error("Search users by phone error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search for users.",
    });
  }
}


// GET /api/conversations

export async function getConversations(req, res) {
  try {
    const currentUserId = req.user._id;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
     .populate(
  "participants",
  "name username profilePicture about isOnline lastSeen"
)
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "username profilePicture",
        },
      })
      .sort({ updatedAt: -1 });

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          sender: { $ne: currentUserId },
          readBy: { $ne: currentUserId },
        });

        return {
          ...conversation.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      conversations: conversationsWithUnread,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch conversations.",
    });
  }
}



/**
 * POST /api/conversations/:conversationId/read
 *
 * Mark all incoming messages in this conversation as read
 * by the currently authenticated user.
 */
export async function markConversationRead(req, res) {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    // Only mark messages sent by other participants as read.
    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
      },
      {
        $addToSet: { readBy: currentUserId },
        $set: { status: "read" },
      }
    );

    const io = req.app.get("io");
    for (const participantId of conversation.participants) {
      if (String(participantId) === String(currentUserId)) continue;

      io?.to(`user:${String(participantId)}`).emit("messages:read", {
        conversationId: String(conversation._id),
        readBy: String(currentUserId),
      });
    }

    return res.status(200).json({
      success: true,
      conversationId: String(conversation._id),
      readBy: String(currentUserId),
    });
  } catch (error) {
    console.error("Mark conversation read error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark messages as read.",
    });
  }
}


// GET /api/conversations/:conversationId/messages
export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }).select("_id");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 30, 1),
      100
    );

     const filter = { conversation: conversation._id, deletedFor: { $ne: req.user._id } };

    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        return res.status(400).json({
          success: false,
          message: "Invalid message cursor.",
        });
      }

      const cursorMessage = await Message.findOne({
        _id: req.query.before,
        conversation: conversation._id,
      }).select("createdAt");

      if (!cursorMessage) {
        return res.status(400).json({
          success: false,
          message: "Message cursor not found.",
        });
      }

      filter.createdAt = { $lt: cursorMessage.createdAt };
    }

    const messages = await Message.find(filter)
    .populate("sender", "username name profilePicture")
    .populate(REPLY_POPULATE)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit);

  return res.status(200).json({
    success: true,
    messages: messages.reverse().map((m) => serializeMessage(m, req.user._id)),
  });

   
const messagesWithAttachmentUrls = messages.reverse().map(
  (message) => {
    const item = message.toObject();

    item.attachments = (item.attachments || []).map(
      (file, index) => ({
        _id: String(file._id),
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        downloadUrl:
          `/conversations/${item.conversation}/messages/${item._id}/attachments/${index}`,
      })
    );

    return item;
  }
);

return res.status(200).json({
  success: true,
  messages: messagesWithAttachmentUrls,
});

  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch messages.",
    });
  }
}

// GET /api/messages/starred
export async function getStarredMessages(req, res) {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    }).select("_id");

    if (conversations.length === 0) {
      return res.status(200).json({ success: true, messages: [] });
    }

    const messages = await Message.find({
      conversation: {
        $in: conversations.map((conversation) => conversation._id),
      },
      starredBy: req.user._id,
      deletedFor: { $ne: req.user._id },
      deletedForEveryone: { $ne: true },
    })
      .populate("sender", "username name profilePicture")
      .populate(REPLY_POPULATE)
      .sort({ createdAt: -1, _id: -1 });

    return res.status(200).json({
      success: true,
      messages: messages.map((message) =>
        serializeMessage(message, req.user._id)
      ),
    });
  } catch (error) {
    console.error("Get starred messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch starred messages.",
    });
  }
}

// POST /api/conversations/:conversationId/messages
export async function sendMessage(req, res) {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text is required.",
      });
    }

    if (text.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: text.trim(),
      type: "text",
      status: hasOnlineRecipient(
        req.app.get("io"),
        conversation,
        req.user._id
      )
        ? "delivered"
        : "sent",
      readBy: [req.user._id],
    });

    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username profilePicture");

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send message.",
    });
  }
}

const uploadDirectory = path.resolve("uploads/attachments");


function getMessageType(files, requestedType = "") {
  if (!files.length) {
    return "text";
  }

  if (requestedType === "voice" && files.length === 1) {
    return "voice";
  }

  if (files.length !== 1) {
    return "file";
  }

  const mimeType = files[0].mimetype || "";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  return "document";
}


// POST /api/conversations/:conversationId/attachments
export async function uploadMessage(req, res) {

  console.log("UPLOAD DEBUG:", {
  body: req.body,
  files: req.files?.map((file) => ({
    name: file.originalname,
    size: file.size,
    field: file.fieldname,
  })),
});


  const uploadedFiles = req.files || [];

  try {
    const { conversationId } = req.params;
    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters.",
      });
    }

    if (!uploadedFiles.length && !text) {
      return res.status(400).json({
        success: false,
        message: "Add a message or at least one file.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const replyTo = await resolveReplyTarget(
      req.body.replyTo,
      conversation._id
    );

    const io = req.app.get("io");
    const message = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      text,
      type: getMessageType(uploadedFiles, req.body.type),
      replyTo,
      attachments: uploadedFiles.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.filename,
      })),
      status: hasOnlineRecipient(io, conversation, req.user._id)
        ? "delivered"
        : "sent",
      readBy: [req.user._id],
    });

    message.attachments.forEach((file, index) => {
      file.url =
        `/conversations/${conversation._id}/messages/${message._id}/attachments/${index}`;
    });

    await message.save();

    conversation.lastMessage = message._id;
    await conversation.save();

        const populated = await Message.findById(message._id)
      .populate("sender", "username name profilePicture")
      .populate(REPLY_POPULATE);
    const publicMessage = serializeMessage(populated);

    for (const participantId of conversation.participants) {
      io?.to(`user:${String(participantId)}`).emit(
        "message:new",
        publicMessage
      );
    }

    return res.status(201).json({
      success: true,
      message: publicMessage,
    });
  } catch (error) {
    // Remove files if saving the message failed.
    await Promise.all(
      uploadedFiles.map((file) =>
        fs.promises
          .unlink(file.path)
          .catch(() => {})
      )
    );

    console.error("Upload message error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to upload attachments.",
    });
  }
}

// GET /api/conversations/:conversationId/messages/:messageId/attachments/:attachmentIndex
export async function downloadAttachment(req, res) {
  try {
    const {
      conversationId,
      messageId,
      attachmentIndex,
    } = req.params;

    if (
      !mongoose.isValidObjectId(conversationId) ||
      !mongoose.isValidObjectId(messageId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation or message ID.",
      });
    }

    const index = Number(attachmentIndex);

    if (!Number.isInteger(index) || index < 0 || index > 9) {
      return res.status(400).json({
        success: false,
        message: "Invalid attachment index.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }).select("_id");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const message = await Message.findOne({
      _id: messageId,
      conversation: conversationId,
    }).select("+attachments.storageKey");

    if (!message || !message.attachments[index]) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found.",
      });
    }

    const attachment = message.attachments[index];
    const filePath = path.resolve(
      uploadDirectory,
      attachment.storageKey
    );

    // Ensure the resolved path stays inside the upload directory.
    if (!filePath.startsWith(uploadDirectory + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attachment path.",
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File is missing from storage.",
      });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.download(
      filePath,
      attachment.originalName
    );
  } catch (error) {
    console.error("Download attachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to download attachment.",
    });
  }
}
