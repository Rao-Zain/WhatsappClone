import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { serializeMessage } from "../utils/serializeMessage.js";
import {
  saveAvatarFromDataUrl,
  deleteAvatarByUrl,
  getPublicBaseUrl,
} from "../utils/avatarStorage.js";

const MAX_MEMBERS = 256;
const MAX_NAME_LENGTH = 50;
const PARTICIPANT_FIELDS = "name username profilePicture about isOnline lastSeen";

const idOf = (value) => String(value?._id || value);
const includesId = (list, id) => list.some((item) => idOf(item) === String(id));
const displayName = (user) => user?.name?.trim() || user?.username || "Someone";

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function serverError(res, label, error) {
  console.error(`${label}:`, error);
  return fail(res, 500, "Something went wrong. Please try again.");
}

// Loads the group and checks who is asking. When it rejects the request it
// sends the error response itself and returns null.
async function loadGroup(req, res, { adminOnly = false } = {}) {
  const { conversationId } = req.params;

  if (!mongoose.isValidObjectId(conversationId)) {
    fail(res, 400, "Invalid conversation ID.");
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    type: "group",
    participants: req.user._id,
  });

  if (!conversation) {
    fail(res, 404, "Group not found.");
    return null;
  }

  if (adminOnly && !includesId(conversation.admins, req.user._id)) {
    fail(res, 403, "Only group admins can do this.");
    return null;
  }

  return conversation;
}

function loadPopulated(conversationId) {
  return Conversation.findById(conversationId)
    .populate("participants", PARTICIPANT_FIELDS)
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "name username profilePicture" },
    });
}

function emitTo(io, userIds, event, payload) {
  for (const userId of userIds) {
    io?.to(`user:${idOf(userId)}`).emit(event, payload);
  }
}

// Saves a line like "Ali added Sara" in the chat and saves the group.
// Everyone counts as having read it, so it never shows unread badges or ticks.
async function createSystemMessage(conversation, actorId, text) {
  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    type: "system",
    text,
    status: "read",
    readBy: conversation.participants,
  });

  conversation.lastMessage = message._id;
  await conversation.save();

  const populated = await Message.findById(message._id).populate(
    "sender",
    "username name profilePicture"
  );

  return serializeMessage(populated);
}

// Sends the refreshed group and the new system line to these people.
async function announce(io, conversation, recipients, systemMessage) {
  const populated = await loadPopulated(conversation._id);

  emitTo(io, recipients, "conversation:updated", populated.toObject());
  emitTo(io, recipients, "message:new", systemMessage);

  return populated;
}

// PATCH /api/conversations/:conversationId/group   Body: { name }
export async function renameGroup(req, res) {
  try {
    const conversation = await loadGroup(req, res, { adminOnly: true });
    if (!conversation) return;

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) return fail(res, 400, "Group name is required.");

    if (name.length > MAX_NAME_LENGTH) {
      return fail(res, 400, `Group name cannot exceed ${MAX_NAME_LENGTH} characters.`);
    }

    if (name === conversation.groupName) {
      return res.json({ success: true, conversation: await loadPopulated(conversation._id) });
    }

    conversation.groupName = name;

    const note = await createSystemMessage(
      conversation,
      req.user._id,
      `${displayName(req.user)} changed the group name to “${name}”`
    );

    const populated = await announce(
      req.app.get("io"),
      conversation,
      conversation.participants,
      note
    );

    return res.json({ success: true, conversation: populated });
  } catch (error) {
    return serverError(res, "Rename group error", error);
  }
}

// PATCH /api/conversations/:conversationId/group/picture
// Body: { picture: "data:image/...;base64,..." }  (or null to remove the photo)
export async function updateGroupPicture(req, res) {
  try {
    const conversation = await loadGroup(req, res, { adminOnly: true });
    if (!conversation) return;

    const { picture } = req.body || {};
    const previousPicture = conversation.groupPicture;
    const actor = displayName(req.user);
    let text;

    if (picture === null || picture === "") {
      if (!previousPicture) {
        return res.json({ success: true, conversation: await loadPopulated(conversation._id) });
      }

      conversation.groupPicture = "";
      text = `${actor} removed the group photo`;
    } else {
      try {
        conversation.groupPicture = await saveAvatarFromDataUrl(picture, getPublicBaseUrl(req));
      } catch (error) {
        if (error.status) return fail(res, error.status, error.message);
        throw error;
      }

      text = `${actor} changed the group photo`;
    }

    const note = await createSystemMessage(conversation, req.user._id, text);

    // Remove the old file so the folder doesn't fill up.
    await deleteAvatarByUrl(previousPicture);

    const populated = await announce(
      req.app.get("io"),
      conversation,
      conversation.participants,
      note
    );

    return res.json({ success: true, conversation: populated });
  } catch (error) {
    return serverError(res, "Group picture error", error);
  }
}

// POST /api/conversations/:conversationId/group/members   Body: { userIds: [id, ...] }
export async function addGroupMembers(req, res) {
  try {
    const conversation = await loadGroup(req, res, { adminOnly: true });
    if (!conversation) return;

    const requested = Array.isArray(req.body?.userIds)
      ? [...new Set(req.body.userIds.map(String))]
      : [];

    if (requested.length === 0) {
      return fail(res, 400, "Choose at least one person to add.");
    }

    if (requested.some((id) => !mongoose.isValidObjectId(id))) {
      return fail(res, 400, "One or more user IDs are invalid.");
    }

    const newIds = requested.filter((id) => !includesId(conversation.participants, id));

    if (newIds.length === 0) {
      return fail(res, 400, "Those people are already in the group.");
    }

    if (conversation.participants.length + newIds.length > MAX_MEMBERS) {
      return fail(res, 400, `A group can have at most ${MAX_MEMBERS} members.`);
    }

    const users = await User.find({
      _id: { $in: newIds },
      emailVerified: true,
    }).select("name username");

    if (users.length !== newIds.length) {
      return fail(res, 404, "One or more users were not found.");
    }

    const previousMembers = [...conversation.participants];
    const addedIds = users.map((user) => user._id);

    conversation.participants.push(...addedIds);

    // New members only care about messages from now on, so the older
    // history counts as read for them (no huge unread badge).
    await Message.updateMany(
      { conversation: conversation._id },
      { $addToSet: { readBy: { $each: addedIds } } }
    );

    const note = await createSystemMessage(
      conversation,
      req.user._id,
      `${displayName(req.user)} added ${users.map(displayName).join(", ")}`
    );

    const populated = await loadPopulated(conversation._id);
    const io = req.app.get("io");

    // Existing members: refresh the group + show the new line.
    emitTo(io, previousMembers, "conversation:updated", populated.toObject());
    emitTo(io, previousMembers, "message:new", note);

    // New members: the group appears in their sidebar.
    emitTo(io, addedIds, "conversation:new", { ...populated.toObject(), unreadCount: 0 });

    return res.json({ success: true, conversation: populated });
  } catch (error) {
    return serverError(res, "Add members error", error);
  }
}

// DELETE /api/conversations/:conversationId/group/members/:userId
export async function removeGroupMember(req, res) {
  try {
    const conversation = await loadGroup(req, res, { adminOnly: true });
    if (!conversation) return;

    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return fail(res, 400, "Invalid user ID.");
    }

    if (userId === String(req.user._id)) {
      return fail(res, 400, "Use “Exit group” to leave the group.");
    }

    if (!includesId(conversation.participants, userId)) {
      return fail(res, 404, "That person isn't in this group.");
    }

    const target = await User.findById(userId).select("name username");

    conversation.participants = conversation.participants.filter(
      (id) => idOf(id) !== userId
    );
    conversation.admins = conversation.admins.filter((id) => idOf(id) !== userId);

    const note = await createSystemMessage(
      conversation,
      req.user._id,
      `${displayName(req.user)} removed ${displayName(target)}`
    );

    const io = req.app.get("io");

    const populated = await announce(io, conversation, conversation.participants, note);

    // The removed person's chat list drops the group.
    emitTo(io, [userId], "conversation:removed", {
      conversationId: String(conversation._id),
    });

    return res.json({ success: true, conversation: populated });
  } catch (error) {
    return serverError(res, "Remove member error", error);
  }
}

// PATCH /api/conversations/:conversationId/group/admins/:userId   Body: { isAdmin: boolean }
export async function setGroupAdmin(req, res) {
  try {
    const conversation = await loadGroup(req, res, { adminOnly: true });
    if (!conversation) return;

    const { userId } = req.params;
    const makeAdmin = req.body?.isAdmin;

    if (!mongoose.isValidObjectId(userId) || typeof makeAdmin !== "boolean") {
      return fail(res, 400, "Invalid request.");
    }

    if (!includesId(conversation.participants, userId)) {
      return fail(res, 404, "That person isn't in this group.");
    }

    const isAdminNow = includesId(conversation.admins, userId);

    if (makeAdmin === isAdminNow) {
      return res.json({ success: true, conversation: await loadPopulated(conversation._id) });
    }

    if (!makeAdmin && conversation.admins.length <= 1) {
      return fail(
        res,
        400,
        "A group needs at least one admin. Make someone else an admin first."
      );
    }

    if (makeAdmin) {
      conversation.admins.push(userId);
    } else {
      conversation.admins = conversation.admins.filter((id) => idOf(id) !== userId);
    }

    const target = await User.findById(userId).select("name username");
    const actor = displayName(req.user);

    const note = await createSystemMessage(
      conversation,
      req.user._id,
      makeAdmin
        ? `${actor} made ${displayName(target)} an admin`
        : `${actor} removed ${displayName(target)} as an admin`
    );

    const populated = await announce(
      req.app.get("io"),
      conversation,
      conversation.participants,
      note
    );

    return res.json({ success: true, conversation: populated });
  } catch (error) {
    return serverError(res, "Set admin error", error);
  }
}

// POST /api/conversations/:conversationId/group/leave
export async function leaveGroup(req, res) {
  try {
    const conversation = await loadGroup(req, res);
    if (!conversation) return;

    const userId = String(req.user._id);
    const io = req.app.get("io");

    conversation.participants = conversation.participants.filter(
      (id) => idOf(id) !== userId
    );
    conversation.admins = conversation.admins.filter((id) => idOf(id) !== userId);

    // The last person left: nobody can open the group any more.
    // (The history stays in the database.)
    if (conversation.participants.length === 0) {
      await conversation.save();
      emitTo(io, [userId], "conversation:removed", {
        conversationId: String(conversation._id),
      });
      return res.json({ success: true });
    }

    // A group must always have an admin: promote the longest-standing member.
    let promotedId = null;

    if (conversation.admins.length === 0) {
      promotedId = conversation.participants[0];
      conversation.admins.push(promotedId);
    }

    const leftNote = await createSystemMessage(
      conversation,
      req.user._id,
      `${displayName(req.user)} left`
    );

    let promotedNote = null;

    if (promotedId) {
      const newAdmin = await User.findById(promotedId).select("name username");

      promotedNote = await createSystemMessage(
        conversation,
        promotedId,
        `${displayName(newAdmin)} is now an admin`
      );
    }

    const populated = await loadPopulated(conversation._id);

    emitTo(io, conversation.participants, "conversation:updated", populated.toObject());
    emitTo(io, conversation.participants, "message:new", leftNote);

    if (promotedNote) {
      emitTo(io, conversation.participants, "message:new", promotedNote);
    }

    // Also covers the leaver's other open tabs.
    emitTo(io, [userId], "conversation:removed", {
      conversationId: String(conversation._id),
    });

    return res.json({ success: true });
  } catch (error) {
    return serverError(res, "Leave group error", error);
  }
}