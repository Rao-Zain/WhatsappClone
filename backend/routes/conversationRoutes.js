
import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
  searchUsersByPhone,
  markConversationRead,
} from "../controllers/conversationController.js";

import upload from "../middleware/uploadMiddleware.js";
import {
  reactToMessage, toggleStarMessage, deleteMessage, forwardMessage,
} from "../controllers/messageActionsController.js";

import {
  uploadMessage,
  downloadAttachment,
} from "../controllers/conversationController.js";


const router = express.Router();

router.use(protect);


router.post(
  "/:conversationId/attachments",
  upload.array("files", 10),
  uploadMessage
);

router.get(
  "/:conversationId/messages/:messageId/attachments/:attachmentIndex",
  downloadAttachment
);


router.get("/search-users", searchUsersByPhone);

router.post("/", createConversation);
router.get("/", getConversations);

router.post("/:conversationId/read", markConversationRead);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);
router.put("/:conversationId/messages/:messageId/reaction", reactToMessage);
router.post("/:conversationId/messages/:messageId/star", toggleStarMessage);
router.post("/:conversationId/messages/:messageId/forward", forwardMessage);
router.delete("/:conversationId/messages/:messageId", deleteMessage);

export default router;
