import express from "express";
import { protect } from "../middleware/authMiddleware.js";
  import { getCalls, markCallsSeen, getIceServers } from "../controllers/callController.js";

const router = express.Router();

router.use(protect);
  router.get("/ice-servers", getIceServers);
router.get("/", getCalls);
router.post("/seen", markCallsSeen);

export default router;