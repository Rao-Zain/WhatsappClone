
import mongoose from "mongoose";

// Metadata for each uploaded attachment.
// The actual file will be stored separately from MongoDB.
const attachmentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },

    // Relative, authenticated API path used to retrieve the file.
    url: {
      type: String,
      required: true,
      trim: true,
    },

    // Internal storage identifier. Never accept this directly
    // from an untrusted client without server-side validation.
    storageKey: {
      type: String,
      default: "",
      select: false,
    },

    // Optional thumbnail for images, videos, or audio previews.
    thumbnailUrl: {
      type: String,
      default: "",
    },

    // Optional media metadata.
    duration: {
      type: Number,
      min: 0,
      default: null,
    },

    width: {
      type: Number,
      min: 1,
      default: null,
    },

    height: {
      type: Number,
      min: 1,
      default: null,
    },
  },
  {
    _id: true,
  }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Text accompanying a message, including media captions.
    text: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },

    // Keep "image" and "file" for compatibility with
    // existing code while adding the new message types.
    type: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "voice",
        "document",
        "file",
        "sticker",
        "contact",
        "location",
        "poll",
        "event",
        "system",
      ],
      default: "text",
      required: true,
    },

    // Supports multiple files in one message.
    // File count and upload limits will be enforced by the API.
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: function (attachments) {
          return attachments.length <= 10;
        },
        message: "A message cannot contain more than 10 attachments.",
      },
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    forwarded: {
      type: Boolean,
      default: false,
    },

    reactions: {
      type: [
        {
          _id: false,
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          emoji: {
            type: String,
            required: true,
            maxlength: 32,
          },
        },
      ],
      default: [],
    },

    starredBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    deletedFor: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    deletedForEveryone: {
      type: Boolean,
      default: false,
    },

    // Delivery state for the existing messaging system.
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Efficient chronological message retrieval.
messageSchema.index({
  conversation: 1,
  createdAt: -1,
});

// Reuse the existing model if it has already been registered.
const Message =
  mongoose.models.Message ||
  mongoose.model("Message", messageSchema);

export default Message;
