import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requirePro } from "../middleware/requirePro.js";
import { createLinkToken, exchangePublicToken, syncPlaid } from "../controllers/plaidController.js";

const router = Router();
router.post("/link-token", authMiddleware, requirePro, createLinkToken);
router.post("/exchange-public-token", authMiddleware, requirePro, exchangePublicToken);
router.post("/sync", authMiddleware, requirePro, syncPlaid);

export default router;
