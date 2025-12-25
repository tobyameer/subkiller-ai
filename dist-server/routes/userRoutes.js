import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { updateMe } from "../controllers/userController.js";

const router = Router();
router.patch("/me", authMiddleware, updateMe);

export default router;
