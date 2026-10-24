import mongoose from "mongoose";

// "blocker" has blocked "blocked". One row per direction.
const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // "rejected-request": created automatically when a chat request is declined.
    reason: {
      type: String,
      enum: ["manual", "rejected-request"],
      default: "manual",
    },
  },
  { timestamps: true }
);

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1 });

const Block = mongoose.models.Block || mongoose.model("Block", blockSchema);

export default Block;