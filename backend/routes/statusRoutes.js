import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import statusUpload from "../middleware/statusUploadMiddleware.js";
import {
  getStatusFeed,
  createStatus,
  getStatusMedia,
  markStatusViewed,
  getStatusViewers,
  deleteStatus,
} from "../controllers/statusController.js";

const router = express.Router();

router.use(protect);

router.get("/", getStatusFeed);
router.post("/", statusUpload.single("file"), createStatus);
router.get("/:statusId/media", getStatusMedia);
router.post("/:statusId/view", markStatusViewed);
router.get("/:statusId/viewers", getStatusViewers);
router.delete("/:statusId", deleteStatus);

export default router;