import { alertError, toast } from "../../../lib/swal";

// Reasons that are a normal end of a call: nothing to tell the user.
const QUIET_REASONS = new Set(["hangup", "no-answer", "answered-elsewhere"]);

/**
 * Tell the user why a call did not happen.
 * `reason` is whatever useCall stored in `endReason`: a code like "media-denied",
 * or a sentence from the server such as "User is busy on another call."
 */
export function showCallEndNotice(reason) {
  if (!reason || QUIET_REASONS.has(reason)) return;

  if (reason === "media-denied") {
    return alertError(
      "Allow microphone access (and camera access for video calls) in your browser's site settings, then try again.",
      { title: "Can't use your microphone or camera" }
    );
  }

  if (reason === "rejected") {
    return toast("Call declined", "info");
  }

  return alertError(
    reason === "failed" ? "The call couldn't be started. Please try again." : reason,
    { title: "Call failed" }
  );
}