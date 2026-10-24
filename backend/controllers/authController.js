
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomInt } from "node:crypto";

import User from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import { sendOtpEmail } from "../utils/sendOtpEmail.js";
import { generatePin } from "../utils/chatPin.js";
import { broadcastProfileUpdate } from "../socket/socket.js";
import {
  saveAvatar,
  deleteAvatarByUrl,
  getPublicBaseUrl,
} from "../utils/avatarStorage.js";

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function hashOtp(otp) {
  return createHash("sha256").update(otp).digest("hex");
}

function getOtpExpiry() {
  const minutes = Math.max(
    1,
    Number(process.env.OTP_EXPIRY_MINUTES) || 10
  );

  return new Date(Date.now() + minutes * 60 * 1000);
}

function getPendingExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function createOtp() {
  return randomInt(100000, 1000000).toString();
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    profilePicture: user.profilePicture,
    about: user.about,
    emailVerified: user.emailVerified,
  };
}

// POST /api/auth/register
export async function register(req, res) {
  try {
    const { username, email, phone, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30
    ) {
      return res.status(400).json({
        success: false,
        message: "Username must be between 3 and 30 characters.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    // Check whether an active account already uses these details.
    const existingUser = await User.findOne({
      $or: [
        { username: normalizedUsername },
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account already uses one or more of these details.",
      });
    }

    // Do not allow a different pending email to reserve the same
    // username or phone number.
    const conflictingPending = await PendingRegistration.findOne({
      email: { $ne: normalizedEmail },
      $or: [
        { username: normalizedUsername },
        { phone: normalizedPhone },
      ],
    });

    if (conflictingPending) {
      return res.status(409).json({
        success: false,
        message:
          "An account registration already uses one or more of these details. Try again later.",
      });
    }

    const otp = createOtp();
    const now = new Date();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create or replace the pending registration for this email.
    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: {
          username: normalizedUsername,
          email: normalizedEmail,
          phone: normalizedPhone,
          password: hashedPassword,
          otpHash: hashOtp(otp),
          otpExpiresAt: getOtpExpiry(),
          otpAttempts: 0,
          lastOtpSentAt: now,
          expiresAt: getPendingExpiry(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      // Don't leave a pending record that appears to have succeeded
      // when the verification email could not be sent.
      await PendingRegistration.deleteOne({
        email: normalizedEmail,
      });

      console.error("OTP email delivery error:", emailError.message);

      return res.status(502).json({
        success: false,
        message:
          "We could not send the verification email. Check the email configuration and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      requiresEmailVerification: true,
      email: normalizedEmail,
      message: "Verification code sent. Check your email.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account registration already uses one or more of these details.",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start registration.",
    });
  }
}

// POST /api/auth/verify-otp
export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !email.trim() ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter your email and the six-digit verification code.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail,
    }).select("+password +otpHash");

    if (!pending) {
      return res.status(400).json({
        success: false,
        message:
          "This registration is unavailable or has expired. Please register again.",
      });
    }

    if (pending.expiresAt <= new Date()) {
      await PendingRegistration.deleteOne({ _id: pending._id });

      return res.status(400).json({
        success: false,
        message: "Your registration has expired. Please register again.",
      });
    }

    if (pending.otpExpiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Your code has expired. Request a new code.",
      });
    }

    const maxAttempts = Math.max(
      1,
      Number(process.env.OTP_MAX_ATTEMPTS) || 5
    );

    if (pending.otpAttempts >= maxAttempts) {
      await PendingRegistration.deleteOne({ _id: pending._id });

      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect attempts. Please register again.",
      });
    }

    if (hashOtp(otp) !== pending.otpHash) {
      pending.otpAttempts += 1;

      if (pending.otpAttempts >= maxAttempts) {
        await pending.deleteOne();

        return res.status(429).json({
          success: false,
          message:
            "Too many incorrect attempts. Please register again.",
        });
      }

      await pending.save();

      return res.status(400).json({
        success: false,
        message: "The verification code is incorrect.",
        attemptsRemaining: maxAttempts - pending.otpAttempts,
      });
    }

    // Check again before creating the active account.
    const conflictingUser = await User.findOne({
      $or: [
        { username: pending.username },
        { email: pending.email },
        { phone: pending.phone },
      ],
    });

    if (conflictingUser) {
      await pending.deleteOne();

      return res.status(409).json({
        success: false,
        message:
          "An account already uses one or more of these details. Please register with different details.",
      });
    }

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      phone: pending.phone,
      password: pending.password,
      emailVerified: true,
    });

    await PendingRegistration.deleteOne({ _id: pending._id });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Email verified. Your account is ready.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account already uses one or more of these details.",
      });
    }

    console.error("OTP verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify the email code.",
    });
  }
}

// POST /api/auth/resend-otp
export async function resendOtp(req, res) {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const pending = await PendingRegistration.findOne({
      email: normalizedEmail,
    });

    if (!pending || pending.expiresAt <= new Date()) {
      if (pending) {
        await pending.deleteOne();
      }

      return res.status(400).json({
        success: false,
        message:
          "This registration is unavailable or has expired. Please register again.",
      });
    }

    const cooldownSeconds = Math.max(
      1,
      Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60
    );

    const elapsedSeconds =
      (Date.now() - pending.lastOtpSentAt.getTime()) / 1000;

    if (elapsedSeconds < cooldownSeconds) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${Math.ceil(
          cooldownSeconds - elapsedSeconds
        )} seconds before requesting another code.`,
      });
    }

    const otp = createOtp();

    pending.otpHash = hashOtp(otp);
    pending.otpExpiresAt = getOtpExpiry();
    pending.otpAttempts = 0;
    pending.lastOtpSentAt = new Date();

    await pending.save();

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error("Resend OTP email error:", emailError.message);

      return res.status(502).json({
        success: false,
        message:
          "Unable to send a new code right now. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to resend the verification code.",
    });
  }
}

// POST /api/auth/login
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required.",
      });
    }

    const identifier = username.trim();

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password.",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
}

// Users created before the PIN feature have no PIN yet: give them one the
// first time they ask. (The schema default is not applied to old documents
// that are loaded without the field, so this writes it explicitly.)
async function ensureChatPin(userId) {
  await User.updateOne(
    { _id: userId, chatPin: { $exists: false } },
    { $set: { chatPin: generatePin() } }
  );

  const withPin = await User.findById(userId).select("+chatPin").lean();

  return withPin?.chatPin || "";
}

export async function getMe(req, res) {
  try {
    const chatPin = await ensureChatPin(req.user._id);

    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name || "",
        username: req.user.username,
        email: req.user.email,
        phone: req.user.phone,
        profilePicture: req.user.profilePicture,
        about: req.user.about,
        emailVerified: req.user.emailVerified,
        createdAt: req.user.createdAt,
        chatPin,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your account.",
    });
  }
}

// POST /api/auth/regenerate-pin  - use if your PIN was shared by mistake
export async function regenerateChatPin(req, res) {
  try {
    const chatPin = generatePin();

    await User.updateOne({ _id: req.user._id }, { $set: { chatPin } });

    return res.status(200).json({ success: true, chatPin });
  } catch (error) {
    console.error("Regenerate PIN error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to generate a new PIN.",
    });
  }
}


export const updateProfile = async (req, res) => {
  try {
    const { name, username, about } = req.body;
    const updates = {};

    if (username !== undefined) {
      const cleanUsername = username.trim();

      if (!cleanUsername) {
        return res.status(400).json({
          success: false,
          message: "Username is required",
        });
      }

      if (cleanUsername.length > 30) {
        return res.status(400).json({
          success: false,
          message: "Username cannot exceed 30 characters",
        });
      }

      const existingUser = await User.findOne({
        username: cleanUsername,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "This username is already taken",
        });
      }

      updates.username = cleanUsername;
    }

    if (about !== undefined) {
      if (typeof about !== "string" || about.length > 139) {
        return res.status(400).json({
          success: false,
          message: "About must be 139 characters or fewer",
        });
      }

      updates.about = about.trim();
    }

    if (name !== undefined) {
  const cleanName = name.trim();

  if (!cleanName) {
    return res.status(400).json({
      success: false,
      message: "Name is required",
    });
  }

  if (cleanName.length > 30) {
    return res.status(400).json({
      success: false,
      message: "Name cannot exceed 30 characters",
    });
  }

  updates.name = cleanName;
}

 const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpires");

    // ADD THIS: `updates` only contains the fields that actually changed
    broadcastProfileUpdate(req.app.get("io"), req.user._id, updates);
       

    

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        phone: updatedUser.phone,
        profilePicture: updatedUser.profilePicture,
        about: updatedUser.about,
        name: updatedUser.name,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};


export async function updateProfilePicture(req, res) {
  try {
    const { profilePicture } = req.body;

    if (typeof profilePicture !== "string") {
      return res.status(400).json({
        success: false,
        message: "A profile picture is required.",
      });
    }

    // Accepts cropped JPEG, PNG, or WebP data URLs from the cropper.
    const match =
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(
        profilePicture
      );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Upload a valid JPEG, PNG, or WebP image.",
      });
    }

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: "The cropped image must be 1 MB or smaller.",
      });
    }

    let fileUrl;

    try {
      fileUrl = await saveAvatar(buffer, match[1], getPublicBaseUrl(req));
    } catch (error) {
      if (error.code === "INVALID_IMAGE") {
        return res.status(400).json({
          success: false,
          message: "The image data is invalid.",
        });
      }
      throw error;
    }

    const previousPicture = req.user.profilePicture;

    req.user.profilePicture = fileUrl;
    await req.user.save();

    // Remove the old file so the folder doesn't fill up.
    await deleteAvatarByUrl(previousPicture);

    // Broadcast to contacts (now only a short URL, not a 1 MB string).
    broadcastProfileUpdate(req.app.get("io"), req.user._id, {
      profilePicture: fileUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully.",
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phone: req.user.phone,
        profilePicture: req.user.profilePicture,
        about: req.user.about,
      },
    });
  } catch (error) {
    console.error("Profile picture update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update your profile picture.",
    });
  }
}
