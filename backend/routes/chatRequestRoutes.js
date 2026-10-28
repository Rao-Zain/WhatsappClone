import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { chatRequestLimiter } from "../middleware/rateLimiters.js";
import {
  sendChatRequest,
  getChatRequests,
  respondToChatRequest,
  cancelChatRequest,
} from "../controllers/chatRequestController.js";

const router = express.Router();

router.use(protect);

router.get("/", getChatRequests);
router.post("/", chatRequestLimiter, sendChatRequest);
router.post("/:requestId/respond", respondToChatRequest);
router.delete("/:requestId", cancelChatRequest);

export default router;