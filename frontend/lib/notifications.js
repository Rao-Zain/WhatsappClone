export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export function showNotification(title, { body, tag, icon, requireInteraction, onClick } = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return null;
  }

  const notification = new Notification(title, {
    body,
    tag,
    icon: icon || "/favicon.ico",
    requireInteraction,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
    onClick?.();
  };

  return notification;
}

export const isAppActive = () => document.hasFocus() && !document.hidden;