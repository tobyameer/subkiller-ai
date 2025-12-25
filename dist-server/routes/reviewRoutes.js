import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  startScan,
  getScanStatus,
  getNextReviewItem,
  verifyReviewItem,
  declineReviewItem,
  listReviewItems,
} from "../controllers/reviewController.js";

const router = Router();

// Scan endpoints
router.post("/gmail/scan/start", authMiddleware, startScan);
router.get("/gmail/scan/status", authMiddleware, getScanStatus);

// Review item endpoints
router.get("/review-items/next", authMiddleware, getNextReviewItem);
router.post("/review-items/:id/verify", authMiddleware, verifyReviewItem);
router.post("/review-items/:id/decline", authMiddleware, declineReviewItem);
router.get("/review-items", authMiddleware, listReviewItems);

export default router;

