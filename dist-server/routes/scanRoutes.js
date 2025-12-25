import { Router } from "express";
import { scanEmail, scanGmail } from "../controllers/scanController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.post("/email", authMiddleware, scanEmail);
router.post("/gmail", authMiddleware, scanGmail);
export default router;
