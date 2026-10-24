import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/blockController.js";

const router = express.Router();

router.use(protect);

router.get("/", getBlockedUsers);
router.post("/:userId", blockUser);
router.delete("/:userId", unblockUser);

export default router;