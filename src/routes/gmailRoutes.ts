import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { authUrl, callback } from "../controllers/gmailController";
import { scanGmail } from "../controllers/scanController";

const router = Router();

router.get("/auth-url", authMiddleware, authUrl);
router.get("/callback", authMiddleware, callback);
router.post("/scan", authMiddleware, scanGmail);

export default router;
