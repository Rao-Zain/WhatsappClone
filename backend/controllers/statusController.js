import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Status from "../models/Status.js";
import Conversation from "../models/Conversation.js";
import Block from "../models/Block.js";
import { getBlockState } from "../utils/blocks.js";
import { statusDirectory, STATUS_TYPES } from "../middleware/statusUploadMiddleware.js";

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;
const USER_FIELDS = "name username profilePicture about";

const room = (userId) => `user:${String(userId)}`;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// Only ever touch files inside uploads/statuses (blocks path traversal).
function filePathFor(storageKey) {
  if (!storageKey) return null;

  const filePath = path.resolve(statusDirectory, storageKey);

  return filePath.startsWith(statusDirectory + path.sep) ? filePath : null;
}

function removeFile(storageKey) {
  const filePath = filePathFor(storageKey);

  return filePath ? fs.promises.unlink(filePath).catch(() => {}) : Promise.resolve();
}

/* ------------------------------------------------------------------ */
/* Who can see whose status                                            */
/* A status is visible to the people you already chat with (an         */
/* accepted chat request) unless one of you blocked the other.         */
/* ------------------------------------------------------------------ */

async function getAudienceIds(userId) {
  const conversations = await Conversation.find({
    type: "private",
    participants: userId,
  })
    .select("participants")
    .lean();

  const ids = new Set();

  for (const conversation of conversations) {
    for (const participant of conversation.participants) {
      if (String(participant) !== String(userId)) ids.add(String(participant));
    }
  }

  if (!ids.size) return [];

  const blocks = await Block.find({
    $or: [
      { blocker: userId, blocked: { $in: [...ids] } },
      { blocker: { $in: [...ids] }, blocked: userId },
    ],
  })
    .select("blocker blocked")
    .lean();

  for (const block of blocks) {
    ids.delete(String(block.blocker));
    ids.delete(String(block.blocked));
  }

  ids.delete(String(userId));

  return [...ids];
}

async function canSeeStatusOf(viewerId, ownerId) {
  if (String(viewerId) === String(ownerId)) return true;

  const chatting = await Conversation.exists({
    type: "private",
    participants: { $all: [viewerId, ownerId], $size: 2 },
  });

  if (!chatting) return false;

  const { blockedByMe, blockedByOther } = await getBlockState(viewerId, ownerId);

  return !blockedByMe && !blockedByOther;
}

// Returns the status if it exists, is still active and this user may see it.
async function loadVisibleStatus(req, res, { withMediaKey = false } = {}) {
  const { statusId } = req.params;

  if (!mongoose.isValidObjectId(statusId)) {
    fail(res, 400, "Invalid status ID.");
    return null;
  }

  let query = Status.findOne({ _id: statusId, expiresAt: { $gt: new Date() } });

  if (withMediaKey) query = query.select("+media.storageKey");

  const status = await query;

  if (!status || !(await canSeeStatusOf(req.user._id, status.user))) {
    fail(res, 404, "This status is no longer available.");
    return null;
  }

  return status;
}

/* ------------------------------------------------------------------ */
/* Serializers                                                         */
/* ------------------------------------------------------------------ */

function serializeStatus(status, viewerId) {
  const m = typeof status.toObject === "function" ? status.toObject() : status;
  const ownerId = String(m.user?._id || m.user);
  const mine = ownerId === String(viewerId);

  return {
    id: String(m._id),
    userId: ownerId,
    type: m.type,
    text: m.text || "",
    backgroundColor: m.backgroundColor,
    caption: m.caption || "",
    mediaUrl: m.type === "text" ? null : `/statuses/${m._id}/media`,
    mimeType: m.media?.mimeType || null,
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    viewed: mine ? true : (m.viewers || []).some((v) => String(v.user) === String(viewerId)),
    viewerCount: mine ? (m.viewers || []).length : undefined,
  };
}

function serializePerson(user) {
  return {
    _id: String(user._id),
    name: user.name || "",
    username: user.username,
    profilePicture: user.profilePicture || "",
    about: user.about || "",
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/statuses                                                   */
/* ------------------------------------------------------------------ */

export async function getStatusFeed(req, res) {
  try {
    const meId = req.user._id;
    const audience = await getAudienceIds(meId);

    const rows = await Status.find({
      user: { $in: [meId, ...audience] },
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .populate("user", USER_FIELDS);

    const mine = [];
    const groups = new Map();

    for (const row of rows) {
      if (!row.user) continue;

      const item = serializeStatus(row, meId);

      if (String(row.user._id) === String(meId)) {
        mine.push(item);
        continue;
      }

      const key = String(row.user._id);

      if (!groups.has(key)) {
        groups.set(key, { user: serializePerson(row.user), statuses: [] });
      }

      groups.get(key).statuses.push(item);
    }

    const contacts = [...groups.values()]
      .map((group) => ({
        ...group,
        latestAt: group.statuses[group.statuses.length - 1].createdAt,
        allViewed: group.statuses.every((status) => status.viewed),
      }))
      // Unseen first, then newest first.
      .sort(
        (a, b) =>
          Number(a.allViewed) - Number(b.allViewed) ||
          new Date(b.latestAt) - new Date(a.latestAt)
      );

    return res.status(200).json({ success: true, mine, contacts });
  } catch (error) {
    console.error("Status feed error:", error);
    return fail(res, 500, "Unable to load status updates.");
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/statuses                                                  */
/* Text:  JSON or form fields  { text, backgroundColor }               */
/* Media: multipart, file field "file", optional { caption }           */
/* ------------------------------------------------------------------ */

export async function createStatus(req, res) {
  const file = req.file || null;

  // Anything that fails after the upload must not leave the file behind.
  const reject = async (status, message) => {
    if (file) await removeFile(file.filename);
    return fail(res, status, message);
  };

  try {
    const meId = req.user._id;
    const body = req.body || {};

    const doc = {
      user: meId,
      expiresAt: new Date(Date.now() + STATUS_LIFETIME_MS),
    };

    if (file) {
      const extension = path.extname(file.originalname).toLowerCase();
      const kind = STATUS_TYPES[extension]?.kind;

      if (!kind) return reject(400, "This file type is not supported for status updates.");

      const caption = typeof body.caption === "string" ? body.caption.trim() : "";

      if (caption.length > 700) {
        return reject(400, "A caption cannot exceed 700 characters.");
      }

      doc.type = kind;
      doc.caption = caption;
      doc.media = {
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.filename,
      };
    } else {
      const text = typeof body.text === "string" ? body.text.trim() : "";

      if (!text) return reject(400, "Write something or choose a photo or video.");

      if (text.length > 700) {
        return reject(400, "A status cannot exceed 700 characters.");
      }

      doc.type = "text";
      doc.text = text;

      if (typeof body.backgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.backgroundColor)) {
        doc.backgroundColor = body.backgroundColor;
      }
    }

    const status = await Status.create(doc);
    const audience = await getAudienceIds(meId);

    // Tell the audience (and my other tabs) to refresh their status list.
    req.app
      .get("io")
      ?.to([...audience, String(meId)].map(room))
      .emit("status:changed", { userId: String(meId) });

    return res.status(201).json({
      success: true,
      status: serializeStatus(status, meId),
    });
  } catch (error) {
    console.error("Create status error:", error);
    return reject(500, "Unable to post your status.");
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/statuses/:statusId/media  (photo / video, login required)  */
/* ------------------------------------------------------------------ */

export async function getStatusMedia(req, res) {
  try {
    const status = await loadVisibleStatus(req, res, { withMediaKey: true });
    if (!status) return;

    const filePath = filePathFor(status.media?.storageKey);

    if (status.type === "text" || !filePath) {
      return fail(res, 404, "This status has no media.");
    }

    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", status.media.mimeType || "application/octet-stream");

    // sendFile also answers video Range requests.
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) fail(res, 404, "The file is no longer available.");
    });
  } catch (error) {
    console.error("Status media error:", error);
    return fail(res, 500, "Unable to load this media.");
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/statuses/:statusId/view                                   */
/* ------------------------------------------------------------------ */

export async function markStatusViewed(req, res) {
  try {
    const status = await loadVisibleStatus(req, res);
    if (!status) return;

    const meId = req.user._id;

    // The owner looking at their own status isn't a "view".
    if (String(status.user) === String(meId)) {
      return res.status(200).json({ success: true });
    }

    const result = await Status.updateOne(
      { _id: status._id, "viewers.user": { $ne: meId } },
      { $push: { viewers: { user: meId, viewedAt: new Date() } } }
    );

    if (result.modifiedCount > 0) {
      req.app.get("io")?.to(room(status.user)).emit("status:viewed", {
        statusId: String(status._id),
        userId: String(meId),
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mark status viewed error:", error);
    return fail(res, 500, "Unable to record this view.");
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/statuses/:statusId/viewers   (owner only)                  */
/* ------------------------------------------------------------------ */

export async function getStatusViewers(req, res) {
  try {
    const { statusId } = req.params;

    if (!mongoose.isValidObjectId(statusId)) {
      return fail(res, 400, "Invalid status ID.");
    }

    const status = await Status.findOne({
      _id: statusId,
      user: req.user._id,
      expiresAt: { $gt: new Date() },
    }).populate("viewers.user", USER_FIELDS);

    if (!status) return fail(res, 404, "This status is no longer available.");

    const viewers = status.viewers
      .filter((viewer) => viewer.user)
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .map((viewer) => ({
        user: serializePerson(viewer.user),
        viewedAt: viewer.viewedAt,
      }));

    return res.status(200).json({ success: true, viewers });
  } catch (error) {
    console.error("Status viewers error:", error);
    return fail(res, 500, "Unable to load the viewers.");
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/statuses/:statusId   (owner only)                       */
/* ------------------------------------------------------------------ */

export async function deleteStatus(req, res) {
  try {
    const { statusId } = req.params;

    if (!mongoose.isValidObjectId(statusId)) {
      return fail(res, 400, "Invalid status ID.");
    }

    const status = await Status.findOneAndDelete({
      _id: statusId,
      user: req.user._id,
    }).select("+media.storageKey");

    if (!status) return fail(res, 404, "Status not found.");

    await removeFile(status.media?.storageKey);

    const audience = await getAudienceIds(req.user._id);

    req.app
      .get("io")
      ?.to([...audience, String(req.user._id)].map(room))
      .emit("status:changed", { userId: String(req.user._id) });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete status error:", error);
    return fail(res, 500, "Unable to delete this status.");
  }
}

/* ------------------------------------------------------------------ */
/* Expired statuses: delete the files, then the records.               */
/* Called at start-up and every 15 minutes (see server.js).            */
/* ------------------------------------------------------------------ */

export async function cleanupExpiredStatuses() {
  try {
    const expired = await Status.find({ expiresAt: { $lte: new Date() } })
      .select("_id +media.storageKey")
      .lean();

    if (!expired.length) return;

    await Promise.all(expired.map((status) => removeFile(status.media?.storageKey)));
    await Status.deleteMany({ _id: { $in: expired.map((status) => status._id) } });
  } catch (error) {
    console.error("Status cleanup error:", error.message);
  }
}