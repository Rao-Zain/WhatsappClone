import mongoose from "mongoose";
import Call from "../models/Call.js";
import User from "../models/User.js";
  import crypto from "crypto";

const idOf = (value) => String(value?._id || value);

export const CALL_POPULATE = {
  path: "conversation",
  select: "type groupName groupPicture participants",
  populate: { path: "participants", select: "name username profilePicture" },
};

// Turns a saved call into what ONE person sees in their call list.
// `call.conversation` must be populated with CALL_POPULATE.
export function serializeCall(call, viewerId) {
  const me = String(viewerId);
  const joined = (call.joined || []).map(idOf);
  const declined = (call.declinedBy || []).map(idOf);
  const isCaller = idOf(call.caller) === me;

  let outcome;

  if (isCaller) {
    if (call.answeredAt) outcome = "answered";
    else if (declined.length > 0 && !call.isGroup) outcome = "declined";
    else outcome = "no-answer";
  } else if (joined.includes(me)) {
    outcome = "answered";
  } else if (declined.includes(me)) {
    outcome = "declined";
  } else {
    outcome = "missed";
  }

  const conversation = call.conversation;
  const conversationId = idOf(conversation);

  let chat;

  if (call.isGroup) {
    chat = {
      id: conversationId,
      type: "group",
      name: conversation?.groupName || "Group",
      avatar: conversation?.groupPicture || "",
      userId: null,
    };
  } else {
    const other = (conversation?.participants || []).find((p) => idOf(p) !== me);

    chat = {
      id: conversationId,
      type: "personal",
      name: other?.name?.trim() || other?.username || "Unknown",
      avatar: other?.profilePicture || "",
      userId: other ? idOf(other) : null,
    };
  }

  return {
    id: String(call._id),
    conversationId,
    type: call.type,
    isGroup: Boolean(call.isGroup),
    direction: isCaller ? "outgoing" : "incoming",
    outcome,
    startedAt: call.startedAt,
    answeredAt: call.answeredAt || null,
    endedAt: call.endedAt || null,
    durationSeconds: call.durationSeconds || 0,
    // Group calls: how many people were on it (the caller plus those who joined).
    participantCount: call.answeredAt ? joined.length + 1 : 1,
    chat,
  };
}

// Calls this person missed since they last opened the calls page.
export function countMissedCalls(user) {
  return Call.countDocuments({
    invited: user._id,
    caller: { $ne: user._id },
    endedAt: { $ne: null },
    joined: { $ne: user._id },
    declinedBy: { $ne: user._id },
    ...(user.callsSeenAt ? { startedAt: { $gt: user.callsSeenAt } } : {}),
  });
}

// GET /api/calls?limit=30&before=<callId>
export async function getCalls(req, res) {
  try {
    const me = req.user._id;

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 30, 1),
      50
    );

    const conditions = [
      { endedAt: { $ne: null } },
      { $or: [{ caller: me }, { invited: me }] },
    ];

    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        return res.status(400).json({
          success: false,
          message: "Invalid call cursor.",
        });
      }

      const cursor = await Call.findById(req.query.before).select("startedAt");

      if (!cursor) {
        return res.status(400).json({
          success: false,
          message: "Call cursor not found.",
        });
      }

      conditions.push({
        $or: [
          { startedAt: { $lt: cursor.startedAt } },
          { startedAt: cursor.startedAt, _id: { $lt: cursor._id } },
        ],
      });
    }

    // One extra row is fetched only to learn whether older calls exist.
    const found = await Call.find({ $and: conditions })
      .sort({ startedAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate(CALL_POPULATE);

    return res.status(200).json({
      success: true,
      hasMore: found.length > limit,
      calls: found.slice(0, limit).map((call) => serializeCall(call, me)),
    });
  } catch (error) {
    console.error("Get calls error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your calls.",
    });
  }
}

// POST /api/calls/seen  - the person opened the calls page, so clear the missed-call badge.
export async function markCallsSeen(req, res) {
  try {
    await User.updateOne({ _id: req.user._id }, { callsSeenAt: new Date() });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mark calls seen error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update your calls.",
    });
  }
}


  /* ------------------------------------------------------------------ */
  /* GET /api/calls/ice-servers                                          */
  /* STUN + TURN details the browser needs to connect a call.            */
  /*                                                                     */
  /* Without a TURN server many calls (mobile data, office Wi-Fi, some   */
  /* home routers) can never connect. Configure ONE of these in .env:    */
  /*  A) your own coturn server:  TURN_URLS + TURN_SECRET                */
  /*  B) a TURN provider:         TURN_URLS + TURN_USERNAME +            */
  /*                              TURN_CREDENTIAL                        */
  /* TURN_URLS is a comma-separated list, e.g.                           */
  /*   turn:turn.example.com:3478,turns:turn.example.com:5349            */
  /* ------------------------------------------------------------------ */
  export function getIceServers(req, res) {
    const iceServers = [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ];

    const urls = (process.env.TURN_URLS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (urls.length && process.env.TURN_SECRET) {
      // coturn "use-auth-secret" (TURN REST API): short-lived login made from the secret.
      const ttl = Math.max(300, Number(process.env.TURN_TTL_SECONDS) || 3600);
      const username = `${Math.floor(Date.now() / 1000) + ttl}:${req.user._id}`;
      const credential = crypto
        .createHmac("sha1", process.env.TURN_SECRET)
        .update(username)
        .digest("base64");

      iceServers.push({ urls, username, credential });
    } else if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      // A TURN provider (Metered, Twilio, Xirsys...) with a fixed login.
      iceServers.push({
        urls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }

    return res.status(200).json({
      success: true,
      iceServers,
      relayAvailable: iceServers.length > 1,
    });
  }