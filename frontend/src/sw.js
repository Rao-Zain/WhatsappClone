/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

/*
 * Service worker:
 *   1. caches the app shell so the installed app opens instantly (and offline)
 *   2. shows Web Push notifications when the app is not on screen
 *   3. opens the right chat when a notification is clicked
 *
 * It never caches API calls, uploads or the socket connection.
 */

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: every page load gets index.html.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//],
  })
);

// The page asks to take over once the user agreed to update.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/* Push                                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

async function appIsOnScreen() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return windows.some((client) => client.visibilityState === "visible");
}

async function showPush(event) {
  let data;

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  // The app is open and visible: it already shows the message itself.
  // (A test notification is always shown, so you can see that it works.)
  if (!data.force && (await appIsOnScreen())) return;

  const title = data.title || "New message";

  await self.registration.showNotification(title, {
    body: data.body || "",
    icon: data.icon || DEFAULT_ICON,
    badge: BADGE,
    // One notification per chat: a newer message replaces the older one.
    tag: data.tag,
    renotify: Boolean(data.tag) && data.kind !== "test",
    timestamp: data.timestamp || Date.now(),
    data: {
      url: data.url || "/app",
      conversationId: data.conversationId || null,
    },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPush(event));
});

/* ------------------------------------------------------------------ */
/* Click                                                               */
/* ------------------------------------------------------------------ */

async function openFromNotification(notification) {
  const { url, conversationId } = notification.data || {};

  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);

  // App already open somewhere: bring it forward and tell it which chat to show.
  if (existing) {
    await existing.focus();
    if (conversationId) existing.postMessage({ type: "OPEN_CHAT", conversationId });
    return;
  }

  // App is closed: start it straight on the chat.
  await self.clients.openWindow(url || "/app");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openFromNotification(event.notification));
});