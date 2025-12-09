import { Router } from "express";
import {
  getSubscriptions,
  postSubscription,
  putSubscription,
  removeSubscription,
  restoreSubscription,
} from "../controllers/subscriptionController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, getSubscriptions);
router.post("/", authMiddleware, postSubscription);
router.put("/:id", authMiddleware, putSubscription);
router.patch("/:id", authMiddleware, putSubscription);
router.delete("/:id", authMiddleware, removeSubscription);
router.post("/:id/restore", authMiddleware, restoreSubscription);

export default router;
