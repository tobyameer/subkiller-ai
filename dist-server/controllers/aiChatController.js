import { generateResponse } from "../services/aiChatService.js";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/ai/chat
 * Chat endpoint for AI Copilot
 */
export async function chat(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { message, context } = req.body;
    const user = req.user || null; // Optional - chat can be public for support

    // Validate request body
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        message: "Message is required and must be a string",
      });
    }

    // Extract user context if provided
    const userTier = context?.userTier || user?.plan || "free";
    const userId = user?.id || null;

    // Generate response
    const result = await generateResponse(message, userId, userTier);

    const latency = Date.now() - startTime;

    // Log request (without sensitive content)
    // eslint-disable-next-line no-console
    console.log("[aiChat] Request processed", {
      requestId,
      userId: userId || "anonymous",
      messageLength: message.length,
      latency,
      refused: result.refused,
      hasError: result.error || false,
    });

    return res.status(200).json({
      reply: result.reply,
    });
  } catch (error) {
    const latency = Date.now() - startTime;

    // eslint-disable-next-line no-console
    console.error("[aiChat] Error processing request", {
      requestId,
      userId: req.user?.id || "anonymous",
      error: error.message,
      latency,
    });

    // Handle validation errors (from sanitizeInput)
    if (error.message.includes("Message") || error.message.includes("too long")) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Pass to error handler
    next(error);
  }
}

