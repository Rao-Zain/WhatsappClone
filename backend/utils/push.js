import webpush from "web-push";

import PushSubscription from "../models/PushSubscription.js";

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

// Keys come from the environment (generate them once with `npm run vapid`).
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL)
let configured = null; // null = not checked yet

function configure() {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ||
    (process.env.EMAIL_FROM ? `mailto:${extractEmail(process.env.EMAIL_FROM)}` : "");

  if (!publicKey || !privateKey || !subject) {
    console.warn(
      "Push notifications are OFF: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (run `npm run vapid`)."
    );
    configured = false;
    return configured;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error("Push notifications are OFF: invalid VAPID settings:", error.message);
    configured = false;
  }

  return configured;
}

function extractEmail(value) {
  const match = String(value).match(/[^\s<>"]+@[^\s<>"]+/);
  return match ? match[0] : "";
}

export function isPushConfigured() {
  return configure();
}

export function getVapidPublicKey() {
  return configure() ? process.env.VAPID_PUBLIC_KEY : null;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

const ONE_DAY_SECONDS = 24 * 60 * 60;

/**
 * Send one payload to every device of the given users.
 * Dead subscriptions (404 / 410) are removed. Never throws.
 * Returns how many devices accepted the message.
 */
export async function sendPushToUsers(userIds, payload) {
  try {
    if (!configure() || !userIds?.length) return 0;

    const subscriptions = await PushSubscription.find({
      user: { $in: userIds },
    }).lean();

    if (!subscriptions.length) return 0;

    const body = JSON.stringify(payload);
    let delivered = 0;

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            body,
            { TTL: ONE_DAY_SECONDS, urgency: "high" }
          );

          delivered += 1;
        } catch (error) {
          // The browser says this subscription is gone for good.
          if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: subscription._id });
            return;
          }

          console.error(
            `Push send failed (${error.statusCode || error.code || "unknown"}):`,
            error.body || error.message
          );
        }
      })
    );

    return delivered;
  } catch (error) {
    console.error("Push error:", error.message);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

const MAX_BODY_LENGTH = 140;

const TYPE_LABELS = {
  image: "📷 Photo",
  video: "🎥 Video",
  voice: "🎤 Voice message",
  audio: "🎧 Audio",
  sticker: "Sticker",
  contact: "👤 Contact",
  location: "📍 Location",
  poll: "📊 Poll",
  event: "📅 Event",
};

function previewOf(message) {
  const text = typeof message.text === "string" ? message.text.trim() : "";

  if (text) {
    return text.length > MAX_BODY_LENGTH
      ? `${text.slice(0, MAX_BODY_LENGTH - 1)}…`
      : text;
  }

  if (TYPE_LABELS[message.type]) return TYPE_LABELS[message.type];

  if (message.type === "document" || message.type === "file") {
    const name = message.attachments?.[0]?.originalName;
    const count = message.attachments?.length || 0;

    if (count > 1) return `📄 ${count} files`;
    return name ? `📄 ${name}` : "📄 Document";
  }

  return "New message";
}

function displayName(user) {
  if (!user || typeof user !== "object") return "Someone";
  return user.name?.trim() || user.username || "Someone";
}

const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value);

/**
 * Is this user looking at the app right now (window visible AND focused)?
 * Clients report that with the "app:state" socket event.
 */
async function isUserActive(io, userId) {
  try {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    return sockets.some((socket) => socket.data?.active === true);
  } catch {
    return false;
  }
}

/**
 * Push a new chat message to everyone in the conversation except the sender
 * (and except people who are looking at the app right now).
 *
 * `conversation` is the Conversation document, `message` is the object
 * returned by serializeMessage() (sender populated).
 * Fire and forget: it never throws and callers should not await it.
 */
export async function notifyNewMessage(io, conversation, message) {
  try {
    if (!configure() || !conversation || !message) return;
    if (message.type === "system" || message.deletedForEveryone) return;

    const senderId = String(message.sender?._id || message.sender);
    const conversationId = String(conversation._id);

    const recipientIds = [];

    for (const participant of conversation.participants) {
      const id = String(participant._id || participant);

      if (id === senderId) continue;
      if (await isUserActive(io, id)) continue;

      recipientIds.push(id);
    }

    if (!recipientIds.length) return;

    const isGroup = conversation.type === "group";
    const sender = displayName(message.sender);
    const preview = previewOf(message);

    const avatar = isGroup
      ? conversation.groupPicture
      : message.sender?.profilePicture;

    await sendPushToUsers(recipientIds, {
      kind: "message",
      title: isGroup ? conversation.groupName || "Group" : sender,
      body: isGroup ? `${sender}: ${preview}` : preview,
      icon: isHttpUrl(avatar) ? avatar : undefined,
      // Same tag as the in-app notification, so one chat never shows twice.
      tag: `chat-${conversationId}`,
      conversationId,
      messageId: String(message._id),
      url: `/app/chat/${conversationId}`,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Message push error:", error.message);
  }
}