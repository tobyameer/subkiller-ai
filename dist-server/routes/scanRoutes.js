import { Router } from "express";
import { scanEmail, scanGmail } from "../controllers/scanController";
import { authMiddleware } from "../middleware/auth";
const router = Router();
router.post("/email", authMiddleware, scanEmail);
router.post("/gmail", authMiddleware, scanGmail);
export default router;
