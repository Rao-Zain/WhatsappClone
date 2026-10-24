import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { REPLY_POPULATE, resolveReplyTarget, serializeMessage } from "../utils/serializeMessage.js";
import { hasOnlineRecipient } from "../utils/messageDelivery.js";
import { countMissedCalls } from "./callController.js";   // with the other imports
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

// POST /api/conversations/group
export async function createGroup(req, res) {
  try {
    const { name, participantIds } = req.body;
    const creatorId = String(req.user._id);

    const groupName = typeof name === "string" ? name.trim() : "";

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: "Group name is required.",
      });
    }

    if (groupName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Group name cannot exceed 50 characters.",
      });
    }

    if (!Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: "Choose at least one member.",
      });
    }

    // Remove duplicates and the creator (they are added automatically).
    const memberIds = [...new Set(participantIds.map(String))].filter(
      (id) => id !== creatorId
    );

    if (memberIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "One or more member IDs are invalid.",
      });
    }

    if (memberIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Add at least one other member.",
      });
    }

    if (memberIds.length > 255) {
      return res.status(400).json({
        success: false,
        message: "A group can have at most 256 members.",
      });
    }

    const members = await User.find({
      _id: { $in: memberIds },
      emailVerified: true,
    }).select("_id");

    if (members.length !== memberIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more users were not found.",
      });
    }

    const created = await Conversation.create({
      type: "group",
      groupName,
      participants: [req.user._id, ...members.map((member) => member._id)],
      admins: [req.user._id],
    });

    const conversation = await Conversation.findById(created._id)
      .populate(
        "participants",
        "name username profilePicture about isOnline lastSeen"
      )
      .populate("lastMessage");

    // Show the new group in every member's sidebar immediately.
    const io = req.app.get("io");
    const payload = { ...conversation.toObject(), unreadCount: 0 };

    for (const member of conversation.participants) {
      if (String(member._id) === creatorId) continue;

      io?.to(`user:${String(member._id)}`).emit("conversation:new", payload);
    }

    return res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Create group error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create the group.",
    });
  }
}


// Makes user text safe to use inside a regular expression.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/conversations/:conversationId/search?q=...
// Finds messages containing the text in ONE conversation (newest first, max 50).
export async function searchMessages(req, res) {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query) {
      return res.status(200).json({ success: true, total: 0, messages: [] });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search text cannot exceed 100 characters.",
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

    const filter = {
      conversation: conversation._id,
      deletedFor: { $ne: req.user._id },
      deletedForEveryone: { $ne: true },
      type: { $ne: "system" },
      // Escaped, so symbols like ( or * are searched as plain text.
      text: { $regex: escapeRegExp(query), $options: "i" },
    };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .populate("sender", "username name profilePicture")
        .sort({ createdAt: -1, _id: -1 })
        .limit(50),
      Message.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      messages: messages.map((message) => serializeMessage(message, req.user._id)),
    });
  } catch (error) {
    console.error("Search messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search messages.",
    });
  }
}

// GET /api/conversations/unread-summary
// Number of unread messages in private chats and in groups (for the nav badges).
export async function getUnreadSummary(req, res) {
  try {
    const currentUserId = req.user._id;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .select("_id type")
      .lean();

    const groupIds = new Set(
      conversations
        .filter((conversation) => conversation.type === "group")
        .map((conversation) => String(conversation._id))
    );

    // Same rule the chat list uses for each chat's unread number.
    const rows = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversations.map((conversation) => conversation._id) },
          sender: { $ne: currentUserId },
          readBy: { $ne: currentUserId },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);

    let chats = 0;
    let groups = 0;

    for (const row of rows) {
      if (groupIds.has(String(row._id))) groups += row.count;
      else chats += row.count;
    }

       const calls = await countMissedCalls(req.user);

    return res.status(200).json({
      success: true,
      unread: { chats, groups, calls },
    });
  } catch (error) {
    console.error("Unread summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load unread counts.",
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
    }).select("_id name  username phone profilePicture about");

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
          select: "name username profilePicture",
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
        const isGroup = conversation.type === "group";

    // Only mark messages sent by other participants as read.
    // In a group, a message only gets blue ticks once EVERY member has read it.
    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: currentUserId },
        readBy: { $ne: currentUserId },
      },
      isGroup
        ? { $addToSet: { readBy: currentUserId } }
        : { $addToSet: { readBy: currentUserId }, $set: { status: "read" } }
    );

    let fullyReadIds = [];

    if (isGroup) {
      const fullyRead = await Message.find({
        conversation: conversation._id,
        status: { $ne: "read" },
        readBy: { $all: [...conversation.participants] },
      }).select("_id");

      fullyReadIds = fullyRead.map((message) => String(message._id));

      if (fullyReadIds.length) {
        await Message.updateMany(
          { _id: { $in: fullyReadIds } },
          { $set: { status: "read" } }
        );
      }
    }

    const io = req.app.get("io");

    if (!isGroup || fullyReadIds.length) {
      for (const participantId of conversation.participants) {
        if (String(participantId) === String(currentUserId)) continue;

        io?.to(`user:${String(participantId)}`).emit("messages:read", {
          conversationId: String(conversation._id),
          readBy: String(currentUserId),
          // Groups: only these messages became fully read.
          ...(isGroup ? { messageIds: fullyReadIds } : {}),
        });
      }
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

         // ?around=<messageId>: a window of messages centred on that message.
    // Used to open an old search result without loading the whole history.
    if (req.query.around) {
      if (!mongoose.isValidObjectId(req.query.around)) {
        return res.status(400).json({
          success: false,
          message: "Invalid message ID.",
        });
      }

      const target = await Message.findOne({ ...filter, _id: req.query.around })
        .populate("sender", "username name profilePicture")
        .populate(REPLY_POPULATE);

      if (!target) {
        return res.status(404).json({
          success: false,
          message: "Message not found.",
        });
      }

      const SIDE = 20;

      const [older, newer] = await Promise.all([
        Message.find({
          ...filter,
          $or: [
            { createdAt: { $lt: target.createdAt } },
            { createdAt: target.createdAt, _id: { $lt: target._id } },
          ],
        })
          .populate("sender", "username name profilePicture")
          .populate(REPLY_POPULATE)
          .sort({ createdAt: -1, _id: -1 })
          .limit(SIDE + 1),
        Message.find({
          ...filter,
          $or: [
            { createdAt: { $gt: target.createdAt } },
            { createdAt: target.createdAt, _id: { $gt: target._id } },
          ],
        })
          .populate("sender", "username name profilePicture")
          .populate(REPLY_POPULATE)
          .sort({ createdAt: 1, _id: 1 })
          .limit(SIDE + 1),
      ]);

      // One extra message was fetched only to learn whether newer ones exist.
      const hasNewer = newer.length > SIDE;

      return res.status(200).json({
        success: true,
        hasNewer,
        // Are there messages above this window? (for scrolling up)
        hasMore: older.length > SIDE,
        messages: [
          ...older.slice(0, SIDE).reverse(),
          target,
          ...newer.slice(0, SIDE),
        ].map(
          (message) => serializeMessage(message, req.user._id)
        ),
      });
    }


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

    // One extra message is fetched only to learn whether older ones exist.
    const found = await Message.find(filter)
      .populate("sender", "username name profilePicture")
      .populate(REPLY_POPULATE)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = found.length > limit;
    const messages = found.slice(0, limit);

    return res.status(200).json({
      success: true,
      hasMore,
      messages: messages.reverse().map((m) => serializeMessage(m, req.user._id)),
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
