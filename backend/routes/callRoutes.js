import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getCalls, markCallsSeen } from "../controllers/callController.js";

const router = express.Router();

router.use(protect);

router.get("/", getCalls);
router.post("/seen", markCallsSeen);

export default router;