import mongoose from "mongoose";

// Wrong-PIN counter per requesting user. A 4-digit PIN only has 10,000
// possibilities, so guessing is limited (see chatRequestController).
const pinAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    failures: { type: Number, default: 0 },

    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// Forget idle records after a day.
pinAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const PinAttempt =
  mongoose.models.PinAttempt ||
  mongoose.model("PinAttempt", pinAttemptSchema);

export default PinAttempt;