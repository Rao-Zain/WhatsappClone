import Swal from "sweetalert2";

/*
 * One place for every popup in the app, so they all look and behave the same.
 * Styling lives in src/theme/swal.css and follows the active theme.
 */

const classes = {
  container: "wa-swal-container",
  popup: "wa-swal-popup",
  title: "wa-swal-title",
  htmlContainer: "wa-swal-text",
  actions: "wa-swal-actions",
  confirmButton: "wa-swal-btn wa-swal-btn--confirm",
  cancelButton: "wa-swal-btn wa-swal-btn--cancel",
  denyButton: "wa-swal-btn wa-swal-btn--danger",
};

const base = Swal.mixin({
  buttonsStyling: false, // we style the buttons ourselves
  reverseButtons: true, // Cancel on the left, action on the right
  heightAuto: false, // the app uses h-dvh; do not let Swal resize <html>/<body>
  scrollbarPadding: false, // the app never scrolls the body
  keydownListenerCapture: true, // Escape closes the popup only, not the screen behind it
  customClass: classes,
});

const toastBase = Swal.mixin({
  toast: true,
  position: "bottom",
  showConfirmButton: false,
  timer: 2800,
  timerProgressBar: false,
  heightAuto: false,
  scrollbarPadding: false,
  customClass: { ...classes, container: "wa-swal-container wa-swal-toast-container", popup: "wa-swal-toast" },
});

/** Best human-readable message from an axios error (or anything thrown). */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  if (error.response?.data?.message) return error.response.data.message;

  // Request was sent but no reply came back: usually the connection.
  if (error.request && !error.response) {
    return "Can't reach the server. Check your internet connection and try again.";
  }

  return fallback;
}

/**
 * Ask the user to confirm something. Resolves to true / false.
 *   danger: red confirm button, "Cancel" is focused so Enter can't delete by accident.
 */
export async function confirmAction({
  title,
  text,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  icon,
}) {
  const result = await base.fire({
    title,
    text,
    icon: icon ?? (danger ? "warning" : "question"),
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    focusCancel: danger,
    customClass: {
      ...classes,
      confirmButton: `wa-swal-btn ${danger ? "wa-swal-btn--danger" : "wa-swal-btn--confirm"}`,
    },
  });

  return result.isConfirmed;
}

export const confirmLogout = () =>
  confirmAction({
    title: "Log out?",
    text: "You will need to sign in again to see your chats.",
    confirmText: "Log out",
    danger: true,
  });

/** Error popup. `error` can be an axios error, an Error, or a plain string. */
export function alertError(error, { title = "Something went wrong", fallback } = {}) {
  return base.fire({
    title,
    text: getErrorMessage(error, fallback),
    icon: "error",
    confirmButtonText: "OK",
  });
}

export function alertSuccess(title, text) {
  return base.fire({ title, text, icon: "success", confirmButtonText: "OK" });
}

export function alertInfo(title, text, { confirmText = "OK", html } = {}) {
  return base.fire({ title, text, html, icon: "info", confirmButtonText: confirmText });
}

/** For menu entries whose feature is not built yet. */
export function comingSoon(feature) {
  return base.fire({
    title: "Coming soon",
    text: `${feature} will be available in a future update.`,
    icon: "info",
    confirmButtonText: "Got it",
  });
}

/** Small non-blocking message at the bottom of the screen. */
export function toast(title, icon = "success") {
  return toastBase.fire({ title, icon });
}

export function closePopup() {
  Swal.close();
}

export { base as Swal };