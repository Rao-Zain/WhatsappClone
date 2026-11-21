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
/* home routers) can never connect. Pick ONE way to get TURN:          */
/*                                                                     */
/*  A) Cloudflare (free up to 1,000 GB a month, no server to run):     */
/*       CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN            */
/*  B) A provider with a fixed login (e.g. Metered Open Relay):        */
/*       TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL                   */
/*  C) Your own coturn server:                                         */
/*       TURN_URLS + TURN_SECRET                                       */
/*                                                                     */
/* TURN_URLS is a comma-separated list, e.g.                           */
/*   turn:turn.example.com:3478,turns:turn.example.com:5349            */
/* ------------------------------------------------------------------ */

const GOOGLE_STUN = {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
};

// Cloudflare logins last 2 hours. We ask for a new one every 30 minutes and share
// it between users, so Cloudflare is contacted a few times an hour, not per call.
const CLOUDFLARE_LOGIN_SECONDS = 2 * 60 * 60;
const CLOUDFLARE_REUSE_MS = 30 * 60 * 1000;

let cloudflareCache = { servers: null, fetchedAt: 0 };

async function getCloudflareIceServers() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();

  if (!keyId || !apiToken) return null;

  if (
    cloudflareCache.servers &&
    Date.now() - cloudflareCache.fetchedAt < CLOUDFLARE_REUSE_MS
  ) {
    return cloudflareCache.servers;
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(
        keyId
      )}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: CLOUDFLARE_LOGIN_SECONDS }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare answered with status ${response.status}`);
    }

    const data = await response.json();
    const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];

    const servers = list
      .filter(Boolean)
      .map((server) => ({
        ...server,
        // Port 53 is blocked by web browsers and only causes a long wait.
        urls: [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url)),
      }))
      .filter((server) => server.urls.length > 0);

    if (!servers.some((server) => server.username && server.credential)) {
      throw new Error("the answer has no TURN login");
    }

    cloudflareCache = { servers, fetchedAt: Date.now() };
    return servers;
  } catch (error) {
    console.error("Cloudflare TURN request failed:", error.message);

    // An older login is still valid for a long time: better than nothing.
    return cloudflareCache.servers;
  }
}

export async function getIceServers(req, res) {
  try {
    let iceServers = [GOOGLE_STUN];

    const cloudflare = await getCloudflareIceServers();

    const urls = (process.env.TURN_URLS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (cloudflare) {
      iceServers = [...cloudflare, GOOGLE_STUN];
    } else if (urls.length && process.env.TURN_SECRET) {
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
      relayAvailable: iceServers.some((server) => server.username),
    });
  } catch (error) {
    console.error("ICE servers error:", error);

    // Calls can still work through STUN alone, so don't fail the request.
    return res.status(200).json({
      success: true,
      iceServers: [GOOGLE_STUN],
      relayAvailable: false,
    });
  }
}