import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { billingPortal, billingStatus, createSession } from "../controllers/billingController";

const router = Router();

router.post("/create-checkout-session", authMiddleware, createSession);
router.get("/status", authMiddleware, billingStatus);
router.get("/portal", authMiddleware, billingPortal);

export default router;
