import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/* Every limiter answers with the same JSON shape the rest of the API uses,
   so the frontend can simply show `message`.

   perUser: count per logged-in user (the route must run `protect` first).
            Without it, requests are counted per IP address.

   NOTE: counters are kept in this server's memory. They reset when the server
   restarts, and each server instance counts separately. That is fine for one
   server; for several, use a shared store (e.g. rate-limit-redis). */
function makeLimiter({ windowMs, limit, message, perUser = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(perUser && {
      keyGenerator: (req) =>
        req.user?._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip),
    }),
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message: message || "Too many requests. Please try again in a few minutes.",
      }),
  });
}

// Whole API, per IP (a safety net, not a feature limit).
export const apiLimiter = makeLimiter({
  windowMs: MINUTE,
  limit: 300,
});

/* ---------------- Account / login ---------------- */

export const loginLimiter = makeLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

export const registerLimiter = makeLimiter({
  windowMs: HOUR,
  limit: 10,
  message: "Too many sign-up attempts. Please try again later.",
});

export const otpVerifyLimiter = makeLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many attempts. Please try again in 15 minutes.",
});

export const otpResendLimiter = makeLimiter({
  windowMs: HOUR,
  limit: 6,
  message: "Too many code requests. Please try again later.",
});

export const forgotPasswordLimiter = makeLimiter({
  windowMs: HOUR,
  limit: 5,
  message: "Too many reset requests. Please try again in an hour.",
});

export const resetPasswordLimiter = makeLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: "Too many attempts. Please try again in 15 minutes.",
});

/* ---------------- Logged-in features (per user) ---------------- */

export const searchLimiter = makeLimiter({
  windowMs: MINUTE,
  limit: 30,
  perUser: true,
  message: "You are searching too fast. Please wait a moment.",
});

export const chatRequestLimiter = makeLimiter({
  windowMs: HOUR,
  limit: 20,
  perUser: true,
  message: "You have sent too many chat requests. Please try again later.",
});

export const messageLimiter = makeLimiter({
  windowMs: MINUTE,
  limit: 120,
  perUser: true,
  message: "You are sending messages too fast. Please slow down.",
});

export const statusPostLimiter = makeLimiter({
  windowMs: HOUR,
  limit: 20,
  perUser: true,
  message: "You have posted too many status updates. Please try again later.",
});