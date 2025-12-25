import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { billingPortal, billingStatus, createSession, upgradeToPro, planStatus, cancelPro } from "../controllers/billingController.js";

const router = Router();
router.post("/create-checkout-session", authMiddleware, createSession);
router.get("/status", authMiddleware, billingStatus);
router.get("/plan", authMiddleware, planStatus);
router.post("/upgrade", authMiddleware, upgradeToPro);
router.post("/cancel", authMiddleware, cancelPro);
router.get("/portal", authMiddleware, billingPortal);
export default router;
