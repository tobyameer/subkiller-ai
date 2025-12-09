import { Router } from "express";
import authRoutes from "./authRoutes";
import subscriptionRoutes from "./subscriptionRoutes";
import scanRoutes from "./scanRoutes";
import billingRoutes from "./billingRoutes";
import gmailRoutes from "./gmailRoutes";
import suggestionRoutes from "./suggestionRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/scan", scanRoutes);
router.use("/billing", billingRoutes);
router.use("/gmail", gmailRoutes);
router.use("/suggestions", suggestionRoutes);

export default router;
