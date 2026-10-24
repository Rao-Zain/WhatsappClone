import mongoose from "mongoose";

// A request from one user ("from") to start chatting with another ("to").
// There is at most one row per (from, to) pair; it is reused if the request
// is sent again after the receiver unblocks the sender.
const chatRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // How the sender found the receiver.
    via: {
      type: String,
      enum: ["phone", "pin"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chatRequestSchema.index({ from: 1, to: 1 }, { unique: true });
chatRequestSchema.index({ to: 1, status: 1, createdAt: -1 });
chatRequestSchema.index({ from: 1, status: 1, createdAt: -1 });

const ChatRequest =
  mongoose.models.ChatRequest ||
  mongoose.model("ChatRequest", chatRequestSchema);

export default ChatRequest;