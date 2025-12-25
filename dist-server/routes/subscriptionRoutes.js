import { Router } from "express";
import { getSubscriptions, postSubscription, putSubscription, removeSubscription, restoreSubscriptionHandler, getSubscriptionCardTransactions, getSubscriptionDetails } from "../controllers/subscriptionController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.get("/", authMiddleware, getSubscriptions);
router.post("/", authMiddleware, postSubscription);
router.put("/:id", authMiddleware, putSubscription);
router.patch("/:id", authMiddleware, putSubscription);
router.delete("/:id", authMiddleware, removeSubscription);
router.post("/:id/restore", authMiddleware, restoreSubscriptionHandler);
router.get("/:id/transactions", authMiddleware, getSubscriptionCardTransactions);
router.get("/:id/details", authMiddleware, getSubscriptionDetails);
export default router;
