import { alertError, alertInfo, confirmAction, getErrorMessage, Swal, toast } from "./swal";
import {
  fetchPushConfig,
  getCurrentSubscription,
  getPermission,
  isIOS,
  isOptedOut,
  isPushSupported,
  isStandalone,
  sendTestPush,
  subscribeToPush,
  turnOffPush,
} from "./push";
import { canInstall, promptInstall } from "../src/pwa/install";

/*
 * Everything the user sees about notifications and installing the app.
 * All of it is SweetAlert, so it matches the rest of the app.
 */

const PROMPT_KEY = "wa.notificationPrompt"; // set once the user answered the first question
let askedThisSession = false;

const IOS_NEEDS_INSTALL =
  "On iPhone and iPad, notifications only work for apps added to the Home Screen. " +
  "Tap the Share button, choose “Add to Home Screen”, open the app from there, " +
  "then turn notifications on in Settings.";

const BLOCKED_HELP = isIOS()
  ? "Notifications are blocked for this app. Open your device Settings, find this app under Notifications, and allow them."
  : "Notifications are blocked for this site. Click the lock icon next to the address, open Site settings, set Notifications to Allow, then try again.";

function explain(error) {
  switch (error?.message) {
    case "not-configured":
      return "Push notifications haven't been set up on the server yet.";
    case "no-service-worker":
      return "The app isn't ready for notifications yet. Reload the page and try again.";
    case "unsupported":
      return "This browser doesn't support push notifications.";
    default:
      return getErrorMessage(error, "Something went wrong while turning on notifications.");
  }
}

/** Asks the browser for permission, then subscribes. Returns true when notifications are on. */
export async function enableNotifications() {
  const permission = await Notification.requestPermission();

  if (permission === "denied") {
    await alertInfo("Notifications are blocked", BLOCKED_HELP);
    return false;
  }

  // The user closed the browser's prompt without choosing.
  if (permission !== "granted") return false;

  try {
    await subscribeToPush();
    toast("Notifications are on");
    return true;
  } catch (error) {
    await alertError(explain(error), { title: "Couldn't turn on notifications" });
    return false;
  }
}

/**
 * Shown once, shortly after the app opens: a friendly question *before* the
 * browser's own permission box (which can't be asked again if dismissed).
 */
export async function maybeAskToEnableNotifications() {
  if (askedThisSession) return;
  askedThisSession = true;

  if (!isPushSupported() || getPermission() !== "default") return;
  if (isIOS() && !isStandalone()) return; // iOS only allows push for installed apps
  if (isOptedOut() || localStorage.getItem(PROMPT_KEY)) return;

  const { configured } = await fetchPushConfig();
  if (!configured) return;

  const accepted = await confirmAction({
    title: "Turn on notifications?",
    text: "Get new messages as they arrive, even when the app is closed.",
    confirmText: "Turn on",
    cancelText: "Not now",
    icon: "question",
  });

  try {
    localStorage.setItem(PROMPT_KEY, accepted ? "accepted" : "dismissed");
  } catch {
    /* storage unavailable */
  }

  if (accepted) await enableNotifications();
}

/** Settings > Notifications. Shows the current state and the right action. */
export async function openNotificationSettings() {
  if (isIOS() && !isStandalone()) {
    return alertInfo("Add the app to your Home Screen first", IOS_NEEDS_INSTALL);
  }

  if (!isPushSupported()) {
    return alertInfo(
      "Not supported",
      "This browser doesn't support push notifications. Try a recent version of Chrome, Edge, Firefox or Safari."
    );
  }

  const { configured } = await fetchPushConfig();
  if (!configured) {
    return alertInfo("Not available yet", "Push notifications haven't been set up on the server yet.");
  }

  const permission = getPermission();

  if (permission === "denied") {
    return alertInfo("Notifications are blocked", BLOCKED_HELP);
  }

  const subscribed = permission === "granted" && Boolean(await getCurrentSubscription());

  if (!subscribed) {
    const turnOn = await confirmAction({
      title: "Turn on notifications?",
      text: "Get new messages as they arrive, even when the app is closed.",
      confirmText: "Turn on",
      icon: "question",
    });

    if (turnOn) await enableNotifications();
    return;
  }

  const choice = await Swal.fire({
    title: "Notifications are on",
    text: "This device gets new messages even when the app is closed.",
    icon: "success",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "Send a test",
    denyButtonText: "Turn off",
    cancelButtonText: "Close",
  });

  if (choice.isConfirmed) {
    try {
      await sendTestPush();
    } catch (error) {
      await alertError(error, { title: "Couldn't send the test" });
    }
  } else if (choice.isDenied) {
    try {
      await turnOffPush();
      toast("Notifications turned off", "info");
    } catch (error) {
      await alertError(error, { title: "Couldn't turn off notifications" });
    }
  }
}

/** Settings > Install app. */
export async function openInstallDialog() {
  if (isStandalone()) {
    return alertInfo("Already installed", "You're using the installed app.");
  }

  if (canInstall()) {
    const outcome = await promptInstall();
    if (outcome === "accepted") toast("Installing the app…");
    return;
  }

  if (isIOS()) {
    return alertInfo(
      "Install on iPhone or iPad",
      "Tap the Share button in Safari, then choose “Add to Home Screen”."
    );
  }

  return alertInfo(
    "Install from your browser",
    "Open your browser's menu and choose “Install app” or “Add to Home screen”. Some browsers can't install web apps."
  );
}