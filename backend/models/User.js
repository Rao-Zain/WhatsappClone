
import mongoose from "mongoose";
import { generatePin } from "../utils/chatPin.js";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    about: {
      type: String,
      default: "Hey there! I am using WhatsApp.",
    },

        // Secret 4-digit PIN. Someone who knows your username AND this PIN can
    // send you a chat request. Never returned unless explicitly selected.
    chatPin: {
      type: String,
      default: () => generatePin(),
      match: /^\d{4}$/,
      select: false,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },
        // When the calls page was last opened (missed calls after this are "new").
    callsSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
