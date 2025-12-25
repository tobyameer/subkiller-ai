import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { acceptSuggestion, ignoreSuggestion, listSuggestions, suggestionSummary } from "../controllers/suggestionController.js";

const router = Router();
router.get("/", authMiddleware, listSuggestions);
router.get("/summary", authMiddleware, suggestionSummary);
router.post("/:id/accept", authMiddleware, acceptSuggestion);
router.post("/:id/ignore", authMiddleware, ignoreSuggestion);
export default router;
