
import express from "express";

import {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  updateProfilePicture,
  updateProfile,
    regenerateChatPin,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);

router.get("/me", protect, getMe);
router.patch("/profile", protect, updateProfile);
router.post("/regenerate-pin", protect, regenerateChatPin);
router.patch(
  "/profile-picture",
  protect,
  updateProfilePicture
);

export default router;
