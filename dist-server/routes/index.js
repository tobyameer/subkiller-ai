import { Router } from "express";
import { requireDb } from "../middleware/dbCheck.js";
import authRoutes from "./authRoutes.js";
import subscriptionRoutes from "./subscriptionRoutes.js";
import scanRoutes from "./scanRoutes.js";
import billingRoutes from "./billingRoutes.js";
import gmailRoutes from "./gmailRoutes.js";
import suggestionRoutes from "./suggestionRoutes.js";
import plaidRoutes from "./plaidRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import userRoutes from "./userRoutes.js";
import newsletterRoutes from "./newsletterRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import aiRoutes from "./aiRoutes.js";

const router = Router();

// Database-dependent routes (return 503 if DB is down)
router.use("/auth", requireDb, authRoutes);
router.use("/subscriptions", requireDb, subscriptionRoutes);
router.use("/scan", requireDb, scanRoutes);
router.use("/billing", requireDb, billingRoutes);
router.use("/gmail", requireDb, gmailRoutes);
router.use("/suggestions", requireDb, suggestionRoutes);
router.use("/plaid", requireDb, plaidRoutes);
router.use("/dashboard", requireDb, dashboardRoutes);
router.use("/users", requireDb, userRoutes);
router.use("/newsletter", newsletterRoutes); // Public route - no DB check required for basic subscription
router.use("/ai", aiRoutes); // AI chat routes - public, optional auth
router.use("/", requireDb, reviewRoutes); // Review routes (server.js already adds /api prefix)

export default router;
