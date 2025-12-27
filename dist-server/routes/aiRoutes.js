import { Router } from "express";
import { chat } from "../controllers/aiChatController.js";
import { aiChatLimiter } from "../middleware/rateLimit.js";
import { optionalAuthMiddleware } from "../middleware/optionalAuth.js";

const router = Router();

/**
 * POST /api/ai/chat
 * Public endpoint (auth optional) for AI Copilot chat
 * Rate limited: 10 requests per minute per IP
 * Auth is optional - chat works for both authenticated and unauthenticated users
 * If user is authenticated, their subscription data will be included in context
 */
router.post(
  "/chat",
  aiChatLimiter, // Rate limiting
  optionalAuthMiddleware, // Optional auth - sets req.user if authenticated, continues if not
  chat
);

export default router;

