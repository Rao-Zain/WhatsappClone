import mongoose from "mongoose";

// One row per call attempt. It is created when the call starts and completed
// when it ends, so unfinished rows (server restarted mid-call) are never shown.
const callSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    isGroup: {
      type: Boolean,
      default: false,
    },

    // Everyone who was called (all other members of the chat).
    invited: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Who actually answered / joined.
    joined: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Who pressed decline.
    declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    durationSeconds: { type: Number, default: 0 },

    endReason: {
      type: String,
      enum: ["hangup", "no-answer", "rejected"],
      default: null,
    },
  },
  { timestamps: true }
);

callSchema.index({ caller: 1, startedAt: -1 });
callSchema.index({ invited: 1, startedAt: -1 });

const Call = mongoose.model("Call", callSchema);

export default Call;