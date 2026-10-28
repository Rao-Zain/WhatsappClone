export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export function showNotification(title, { body, tag, icon, requireInteraction, onClick, data } = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const options = {
    body,
    tag,
    icon: icon || "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    requireInteraction,
    data,
  };

  try {
    const notification = new Notification(title, options);

    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };

    return notification;
  } catch {
    // Android Chrome (and installed apps) refuse `new Notification()`:
    // only the service worker may show notifications there.
    navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => registration?.showNotification(title, options))
      .catch(() => {});

    return null;
  }
}

export const isAppActive = () => document.hasFocus() && !document.hidden;