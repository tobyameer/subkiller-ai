import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { authUrl, callback, debugConfig, status, disconnect } from "../controllers/gmailController.js";
import { scanGmail } from "../controllers/scanController.js";

const router = Router();
router.get("/auth-url", authMiddleware, authUrl);
router.get("/callback", authMiddleware, callback);
router.get("/debug-config", authMiddleware, debugConfig);
router.get("/status", authMiddleware, status);
router.post("/scan", authMiddleware, scanGmail);
router.post("/disconnect", authMiddleware, disconnect);
export default router;
