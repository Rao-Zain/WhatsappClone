
import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    lastOtpSentAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Automatically remove abandoned registrations after 24 hours.
// MongoDB TTL cleanup is asynchronous, not immediate.
pendingRegistrationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema
);

export default PendingRegistration;
