import crypto from "crypto";

export const PIN_REGEX = /^\d{4}$/;

// Random 4-digit PIN ("0042" is valid), from a cryptographically secure source.
export function generatePin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

// Constant-time comparison so response timing never leaks digits.
export function pinsMatch(stored, provided) {
  if (typeof stored !== "string" || typeof provided !== "string") return false;
  if (!PIN_REGEX.test(stored) || !PIN_REGEX.test(provided)) return false;

  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(provided));
}