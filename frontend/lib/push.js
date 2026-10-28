import api from "./api";

/*
 * Web Push, the plumbing. (The dialogs the user sees are in pushFlows.js.)
 *
 *   permission  -> the browser's "Allow notifications" choice
 *   subscription -> this browser's address at the push service, stored on our server
 */

const OPT_OUT_KEY = "wa.pushOptOut";

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const getPermission = () =>
  "Notification" in window ? Notification.permission : "unsupported";

export const isStandalone = () =>
  Boolean(window.matchMedia?.("(display-mode: standalone)").matches) ||
  window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// True once this device is subscribed (used to avoid showing a message twice).
let pushActive = false;
export const isPushActive = () => pushActive;

// The user switched notifications off in Settings: do not silently turn them back on.
export const isOptedOut = () => localStorage.getItem(OPT_OUT_KEY) === "1";

function setOptedOut(value) {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* storage unavailable */
  }
}

function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function sameKey(buffer, bytes) {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((value, index) => value === bytes[index]);
}

// `serviceWorker.ready` never settles when no worker is registered (e.g. a dev
// server without one), so give up after a few seconds instead of hanging.
async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
}

export async function getCurrentSubscription() {
  const registration = await getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Does the server have push set up? */
export async function fetchPushConfig() {
  try {
    const { data } = await api.get("/push/public-key");
    return { configured: Boolean(data.configured), publicKey: data.publicKey || null };
  } catch {
    return { configured: false, publicKey: null };
  }
}

/**
 * Subscribe this browser and register it with the server.
 * The caller must already have notification permission.
 * Throws Error("unsupported" | "not-configured" | "no-service-worker") or a browser/API error.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("unsupported");

  const { configured, publicKey } = await fetchPushConfig();
  if (!configured) throw new Error("not-configured");

  const registration = await getRegistration();
  if (!registration) throw new Error("no-service-worker");

  const serverKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  // The server's key changed: the old subscription can never receive anything.
  if (subscription && !sameKey(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKey,
    });
  }

  // Safe to repeat: the server upserts on the endpoint (and moves it to this account).
  await api.post("/push/subscribe", { subscription: subscription.toJSON() });

  pushActive = true;
  setOptedOut(false);

  return subscription;
}

/** Settings > Turn off. Keeps the browser permission, removes this device from the server. */
export async function turnOffPush() {
  setOptedOut(true);
  pushActive = false;

  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  try {
    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe();
  }
}

/**
 * On logout: stop this device receiving the previous account's messages.
 * Reads the token synchronously, so call it BEFORE the session is cleared.
 * Never throws and need not be awaited.
 */
export async function forgetThisDevice() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  pushActive = false;

  try {
    if (!isPushSupported()) return;

    const subscription = await getCurrentSubscription();
    if (!subscription) return;

    if (token) {
      await api
        .post(
          "/push/unsubscribe",
          { endpoint: subscription.endpoint },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .catch(() => {});
    }

    await subscription.unsubscribe();
  } catch {
    /* logging out must never fail because of this */
  }
}

/**
 * Run when the app opens (logged in): if the user already allowed notifications,
 * make sure this device is subscribed and known to the server. Heals expired
 * subscriptions and the "logged in as someone else on this browser" case.
 */
export async function syncPushSubscription() {
  pushActive = false;

  if (!isPushSupported() || getPermission() !== "granted" || isOptedOut()) return false;

  try {
    await subscribeToPush();
    return true;
  } catch {
    return false;
  }
}

export async function sendTestPush() {
  const { data } = await api.post("/push/test");
  return data;
}