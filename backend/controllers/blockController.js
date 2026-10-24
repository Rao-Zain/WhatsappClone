import mongoose from "mongoose";
import User from "../models/User.js";
import Block from "../models/Block.js";
import ChatRequest from "../models/ChatRequest.js";

const room = (userId) => `user:${String(userId)}`;

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// POST /api/blocks/:userId
export async function blockUser(req, res) {
  try {
    const { userId } = req.params;
    const meId = req.user._id;

    if (!mongoose.isValidObjectId(userId)) {
      return fail(res, 400, "Invalid user ID.");
    }

    if (String(userId) === String(meId)) {
      return fail(res, 400, "You cannot block yourself.");
    }

    const target = await User.findById(userId).select("_id");

    if (!target) {
      return fail(res, 404, "User not found.");
    }

    await Block.updateOne(
      { blocker: meId, blocked: target._id },
      { $setOnInsert: { reason: "manual" } },
      { upsert: true }
    );

    // Any chat request still waiting between the two is dropped.
    const pending = await ChatRequest.find({
      status: "pending",
      $or: [
        { from: meId, to: target._id },
        { from: target._id, to: meId },
      ],
    }).select("_id from to");

    if (pending.length) {
      await ChatRequest.deleteMany({ _id: { $in: pending.map((r) => r._id) } });
    }

    const io = req.app.get("io");

    for (const request of pending) {
      const payload = { id: String(request._id) };
      io?.to(room(request.from)).emit("chat-request:removed", payload);
      io?.to(room(request.to)).emit("chat-request:removed", payload);
    }

    // Blocker's other tabs + the blocked person's open chat update live.
    io?.to(room(meId)).emit("block:updated", {
      userId: String(target._id),
      blockedByMe: true,
    });
    io?.to(room(target._id)).emit("block:updated", {
      userId: String(meId),
      blockedByOther: true,
    });

    return res.status(200).json({ success: true, blocked: true });
  } catch (error) {
    console.error("Block user error:", error);
    return fail(res, 500, "Unable to block this user.");
  }
}

// DELETE /api/blocks/:userId
export async function unblockUser(req, res) {
  try {
    const { userId } = req.params;
    const meId = req.user._id;

    if (!mongoose.isValidObjectId(userId)) {
      return fail(res, 400, "Invalid user ID.");
    }

    await Block.deleteOne({ blocker: meId, blocked: userId });

    const io = req.app.get("io");

    io?.to(room(meId)).emit("block:updated", {
      userId: String(userId),
      blockedByMe: false,
    });
    io?.to(room(userId)).emit("block:updated", {
      userId: String(meId),
      blockedByOther: false,
    });

    return res.status(200).json({ success: true, blocked: false });
  } catch (error) {
    console.error("Unblock user error:", error);
    return fail(res, 500, "Unable to unblock this user.");
  }
}

// GET /api/blocks  - everyone I have blocked
export async function getBlockedUsers(req, res) {
  try {
    const rows = await Block.find({ blocker: req.user._id })
      .populate("blocked", "name username profilePicture about")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      users: rows
        .filter((row) => row.blocked)
        .map((row) => ({
          _id: String(row.blocked._id),
          name: row.blocked.name || "",
          username: row.blocked.username,
          profilePicture: row.blocked.profilePicture || "",
          about: row.blocked.about || "",
          blockedAt: row.createdAt,
        })),
    });
  } catch (error) {
    console.error("Get blocked users error:", error);
    return fail(res, 500, "Unable to load blocked contacts.");
  }
}