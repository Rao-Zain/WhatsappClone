import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getStarredMessages } from "../controllers/conversationController.js";

const router = express.Router();

router.use(protect);

router.get("/starred", getStarredMessages);

export default router;
