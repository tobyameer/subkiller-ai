import { Router } from "express";
import { login, me, register, logout } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();
// Apply rate limiting to auth endpoints (prevent brute force)
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", authLimiter, logout);
router.get("/me", authMiddleware, me);
export default router;
