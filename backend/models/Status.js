import mongoose from "mongoose";

// One status update ("story"). It disappears 24 hours after it was posted.
const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video"],
      required: true,
    },

    // Text statuses: the words and the background colour behind them.
    text: {
      type: String,
      trim: true,
      default: "",
      maxlength: 700,
    },

    backgroundColor: {
      type: String,
      default: "#128c7e",
      match: /^#[0-9a-fA-F]{6}$/,
    },

    // Photo / video statuses: optional caption.
    caption: {
      type: String,
      trim: true,
      default: "",
      maxlength: 700,
    },

    media: {
      originalName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
      // Name of the file inside uploads/statuses. Never sent to the client.
      storageKey: { type: String, default: "", select: false },
    },

    // Who has seen it (never includes the owner).
    viewers: {
      type: [
        {
          _id: false,
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          viewedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

statusSchema.index({ user: 1, expiresAt: 1 });
statusSchema.index({ expiresAt: 1 });

const Status = mongoose.models.Status || mongoose.model("Status", statusSchema);

export default Status;