import { Router } from "express";
import { login, me, register, logout } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);
export default router;
