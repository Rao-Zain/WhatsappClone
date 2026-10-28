import express from "express";

import {
  getPublicKey,
  subscribe,
  unsubscribe,
  sendTest,
} from "../controllers/pushController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public-key", getPublicKey);
router.post("/subscribe", protect, subscribe);
router.post("/unsubscribe", protect, unsubscribe);
router.post("/test", protect, sendTest);

export default router;