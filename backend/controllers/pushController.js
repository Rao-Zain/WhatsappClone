import PushSubscription from "../models/PushSubscription.js";
import {
  getVapidPublicKey,
  isPushConfigured,
  sendPushToUsers,
} from "../utils/push.js";

const MAX_DEVICES_PER_USER = 10;
const TEST_COOLDOWN_MS = 10 * 1000;
const lastTest = new Map(); // userId -> time of the last test notification

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// GET /api/push/public-key
export function getPublicKey(req, res) {
  const publicKey = getVapidPublicKey();

  return res.json({
    success: true,
    configured: Boolean(publicKey),
    publicKey: publicKey || null,
  });
}

// POST /api/push/subscribe   { subscription: PushSubscription.toJSON() }
export async function subscribe(req, res) {
  try {
    if (!isPushConfigured()) {
      return fail(res, 503, "Push notifications are not set up on the server.");
    }

    const { endpoint, keys } = req.body?.subscription || {};

    let url;
    try {
      url = new URL(endpoint);
    } catch {
      return fail(res, 400, "Invalid push subscription.");
    }

    if (
      url.protocol !== "https:" ||
      endpoint.length > 2048 ||
      typeof keys?.p256dh !== "string" ||
      typeof keys?.auth !== "string" ||
      !keys.p256dh ||
      !keys.auth
    ) {
      return fail(res, 400, "Invalid push subscription.");
    }

    // Upsert on the endpoint: logging in as someone else on the same browser
    // moves the subscription to the new account.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    // Keep the newest devices only.
    const mine = await PushSubscription.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .select("_id")
      .lean();

    if (mine.length > MAX_DEVICES_PER_USER) {
      await PushSubscription.deleteMany({
        _id: { $in: mine.slice(MAX_DEVICES_PER_USER).map((item) => item._id) },
      });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return fail(res, 500, "Unable to turn on notifications.");
  }
}

// POST /api/push/unsubscribe   { endpoint }
export async function unsubscribe(req, res) {
  try {
    const { endpoint } = req.body || {};

    if (typeof endpoint !== "string" || !endpoint) {
      return fail(res, 400, "Missing endpoint.");
    }

    // Only the owner can remove it.
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });

    return res.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return fail(res, 500, "Unable to turn off notifications.");
  }
}

// POST /api/push/test
export async function sendTest(req, res) {
  try {
    if (!isPushConfigured()) {
      return fail(res, 503, "Push notifications are not set up on the server.");
    }

    const userId = String(req.user._id);
    const now = Date.now();

    if (now - (lastTest.get(userId) || 0) < TEST_COOLDOWN_MS) {
      return fail(res, 429, "Please wait a few seconds before sending another test.");
    }

    lastTest.set(userId, now);

    const devices = await sendPushToUsers([userId], {
      kind: "test",
      force: true, // show it even though the app is open
      title: "Notifications are on",
      body: "You'll get new messages here, even when the app is closed.",
      tag: "push-test",
      url: "/app",
      timestamp: now,
    });

    if (!devices) {
      return fail(res, 404, "No device is registered for notifications. Turn them on first.");
    }

    return res.json({ success: true, devices });
  } catch (error) {
    console.error("Push test error:", error);
    return fail(res, 500, "Unable to send a test notification.");
  }
}