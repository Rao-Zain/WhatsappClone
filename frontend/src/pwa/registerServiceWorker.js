import { registerSW } from "virtual:pwa-register";
import { confirmAction } from "../../lib/swal";

const HOUR = 60 * 60 * 1000;

/** Registers the service worker (offline shell + push) and offers updates. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const updateServiceWorker = registerSW({
    immediate: true,

    // A new version is downloaded and waiting. Ask, so we never reload in the
    // middle of a call or a message being typed.
    async onNeedRefresh() {
      const reload = await confirmAction({
        title: "Update available",
        text: "A new version of the app is ready. Reload to update?",
        confirmText: "Reload",
        cancelText: "Later",
        icon: "info",
      });

      if (reload) updateServiceWorker(true);
    },

    // Look for a new version every hour while the app stays open.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), HOUR);
    },

    onRegisterError(error) {
      console.error("Service worker registration failed:", error);
    },
  });
}