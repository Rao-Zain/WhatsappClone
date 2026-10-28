import mongoose from "mongoose";

// A pending "forgot password" request: one row per user.
const passwordResetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    email: { type: String, required: true, lowercase: true, trim: true },

    // Only a hash of the 6-digit code is stored.
    otpHash: { type: String, required: true, select: false },

    otpExpiresAt: { type: Date, required: true },

    otpAttempts: { type: Number, default: 0 },

    lastSentAt: { type: Date, required: true },

    // The whole request disappears after an hour (MongoDB removes it shortly after).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordReset =
  mongoose.models.PasswordReset ||
  mongoose.model("PasswordReset", passwordResetSchema);

export default PasswordReset;