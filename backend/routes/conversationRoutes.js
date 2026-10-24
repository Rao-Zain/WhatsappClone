
import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  createConversation,
  createGroup,
  getConversations,
  getMessages,
  sendMessage,
  searchUsersByPhone,
  markConversationRead,
  searchMessages,
  getUnreadSummary,
} from "../controllers/conversationController.js";

import {
  renameGroup,
  updateGroupPicture,
  addGroupMembers,
  removeGroupMember,
  setGroupAdmin,
  leaveGroup,
} from "../controllers/groupController.js";

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

router.get("/unread-summary", getUnreadSummary);

router.post("/", createConversation);
router.post("/group", createGroup);

// Group management
router.patch("/:conversationId/group", renameGroup);
router.patch("/:conversationId/group/picture", updateGroupPicture);
router.post("/:conversationId/group/members", addGroupMembers);
router.delete("/:conversationId/group/members/:userId", removeGroupMember);
router.patch("/:conversationId/group/admins/:userId", setGroupAdmin);
router.post("/:conversationId/group/leave", leaveGroup);


router.get("/", getConversations);

router.post("/:conversationId/read", markConversationRead);
router.get("/:conversationId/messages", getMessages);
router.get("/:conversationId/search", searchMessages);
router.post("/:conversationId/messages", sendMessage);
router.put("/:conversationId/messages/:messageId/reaction", reactToMessage);
router.post("/:conversationId/messages/:messageId/star", toggleStarMessage);
router.post("/:conversationId/messages/:messageId/forward", forwardMessage);
router.delete("/:conversationId/messages/:messageId", deleteMessage);

export default router;
