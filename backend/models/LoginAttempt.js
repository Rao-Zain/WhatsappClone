import mongoose from "mongoose";

// Failed-login counter. One row per "key" (see utils/loginGuard.js).
const loginAttemptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    failures: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// Forget idle records after a day.
loginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const LoginAttempt =
  mongoose.models.LoginAttempt ||
  mongoose.model("LoginAttempt", loginAttemptSchema);

export default LoginAttempt;