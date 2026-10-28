import mongoose from "mongoose";

// One row per browser/device that agreed to receive push notifications.
// The endpoint is unique: when someone else logs in on the same browser,
// the row simply moves to the new user.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    endpoint: {
      type: String,
      required: true,
      unique: true,
      maxlength: 2048,
    },

    keys: {
      p256dh: { type: String, required: true, maxlength: 256 },
      auth: { type: String, required: true, maxlength: 256 },
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { timestamps: true }
);

const PushSubscription = mongoose.model(
  "PushSubscription",
  pushSubscriptionSchema
);

export default PushSubscription;