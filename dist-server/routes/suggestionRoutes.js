import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { acceptSuggestion, ignoreSuggestion, listSuggestions, suggestionSummary, } from "../controllers/suggestionController";
const router = Router();
router.get("/", authMiddleware, listSuggestions);
router.get("/summary", authMiddleware, suggestionSummary);
router.post("/:id/accept", authMiddleware, acceptSuggestion);
router.post("/:id/ignore", authMiddleware, ignoreSuggestion);
export default router;
