import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getDashboardSummary, getRecentCharges } from "../controllers/dashboardController.js";

const router = Router();
router.get("/summary", authMiddleware, getDashboardSummary);
router.get("/recent-charges", authMiddleware, getRecentCharges);

export default router;
