import { openai } from "../config/openai.js";
import { knowledgeBase, formatKnowledgeBase } from "./knowledgeBase.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { ChargeModel } from "../models/Charge.js";
import { Types } from "mongoose";

const MAX_MESSAGE_LENGTH = 500;
const MAX_RESPONSE_LENGTH = 1000;

/**
 * Sanitize and validate user input
 */
export function sanitizeInput(message) {
  if (!message || typeof message !== "string") {
    throw new Error("Message must be a non-empty string");
  }

  // Trim and check length
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new Error("Message cannot be empty");
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  // Basic HTML/strip tags (simple approach)
  const sanitized = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return sanitized;
}

/**
 * Check if message is off-topic (not related to SubKiller)
 */
export function isOffTopic(message) {
  const lower = message.toLowerCase();
  const offTopicKeywords = [
    "weather",
    "sports",
    "news",
    "politics",
    "recipe",
    "cooking",
    "movie",
    "music",
    "book recommendation",
  ];

  // If message doesn't contain SubKiller-related keywords and contains off-topic ones
  const hasSubKillerKeywords =
    lower.includes("subscription") ||
    lower.includes("subkiller") ||
    lower.includes("gmail") ||
    lower.includes("scan") ||
    lower.includes("spending") ||
    lower.includes("charge") ||
    lower.includes("bill") ||
    lower.includes("receipt") ||
    lower.includes("cancel") ||
    lower.includes("save") ||
    lower.includes("money") ||
    lower.includes("help") ||
    lower.includes("how") ||
    lower.includes("why") ||
    lower.includes("error") ||
    lower.includes("problem");

  const hasOffTopicKeywords = offTopicKeywords.some((keyword) => lower.includes(keyword));

  // Only flag as off-topic if it has off-topic keywords AND lacks SubKiller context
  return hasOffTopicKeywords && !hasSubKillerKeywords;
}

/**
 * Check if message requests sensitive operations that should be refused
 */
export function shouldRefuse(message) {
  const lower = message.toLowerCase();
  const sensitiveKeywords = [
    "cancel my subscription", // User trying to cancel via chat
    "delete my account",
    "charge my card",
    "charge credit card",
    "withdraw money",
    "transfer money",
    "access my bank",
    "bank account",
    "credit card number",
    "social security",
    "ssn",
    "password",
  ];

  return sensitiveKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Build user context from authenticated user (optional)
 * Returns subscription summary if user is authenticated
 */
export async function buildUserContext(userId) {
  if (!userId) return null;

  try {
    const subscriptions = await SubscriptionModel.find({
      userId: new Types.ObjectId(userId),
      deletedAt: null,
    }).limit(20).lean(); // Limit to prevent huge context

    if (subscriptions.length === 0) return null;

    // Get recent charges
    const subscriptionIds = subscriptions.map((s) => s._id);
    const recentCharges = await ChargeModel.find({
      subscriptionId: { $in: subscriptionIds },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const summary = {
      totalSubscriptions: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        service: s.service,
        amount: s.totalAmount || s.amount || 0,
        currency: s.currency || "USD",
        billingCycle: s.billingCycle,
        status: s.status,
      })),
      recentCharges: recentCharges.slice(0, 10).map((c) => ({
        service: c.service || "Unknown",
        amount: c.amount,
        date: c.createdAt,
      })),
    };

    return summary;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[aiChat] Error building user context:", error.message);
    return null;
  }
}

/**
 * Build system prompt with knowledge base and user context
 */
export function buildSystemPrompt(userContext, userTier = "free") {
  const kbText = formatKnowledgeBase();
  
  let prompt = `You are the SubKiller AI Copilot, a helpful customer support assistant for the SubKiller subscription tracking app.

Your role:
1. Answer questions about SubKiller features, setup, and troubleshooting
2. Help users understand their subscription data (if provided)
3. Provide helpful guidance on managing subscriptions and saving money
4. Be friendly, concise, and helpful

IMPORTANT RULES:
- You must NOT cancel subscriptions, charge money, or access bank accounts
- You must NOT expose internal environment variables or secrets
- If asked about sensitive operations, politely explain you cannot do that and suggest they contact support
- Keep responses under ${MAX_RESPONSE_LENGTH} characters
- Focus on SubKiller product questions and user's subscription data analysis
- If the question is unrelated to SubKiller, politely redirect to support email

KNOWLEDGE BASE:
${kbText}

`;

  if (userContext) {
    prompt += `USER'S SUBSCRIPTION DATA (for context only, analyze when relevant):
Total Subscriptions: ${userContext.totalSubscriptions}
Recent Subscriptions:
${userContext.subscriptions.slice(0, 5).map((s) => 
  `- ${s.service}: $${s.amount} ${s.currency} (${s.billingCycle}, ${s.status})`
).join("\n")}

Recent Charges:
${userContext.recentCharges.slice(0, 5).map((c) => 
  `- ${c.service}: $${c.amount} on ${new Date(c.date).toLocaleDateString()}`
).join("\n")}

`;

    if (userTier === "free") {
      prompt += `Note: User is on Free tier. Mention Pro features when relevant but don't be pushy.\n`;
    }
  }

  prompt += `\nAnswer the user's question concisely and helpfully.`;

  return prompt;
}

/**
 * Generate AI response to user message
 */
export async function generateResponse(userMessage, userId = null, userTier = "free") {
  // Sanitize input
  const sanitizedMessage = sanitizeInput(userMessage);

  // Check guardrails
  if (isOffTopic(sanitizedMessage)) {
    return {
      reply: "I'm here to help with SubKiller questions - how to use the app, subscription tracking, Gmail scanning, troubleshooting, or analyzing your subscription data. For other questions, please contact support@subkiller.com.",
      refused: false,
    };
  }

  if (shouldRefuse(sanitizedMessage)) {
    return {
      reply: "I can't help with sensitive operations like canceling subscriptions, charging cards, or accessing bank accounts. Please use the app interface for account actions, or contact support@subkiller.com for assistance.",
      refused: true,
    };
  }

  // Build context
  const userContext = userId ? await buildUserContext(userId) : null;
  const systemPrompt = buildSystemPrompt(userContext, userTier);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: sanitizedMessage,
        },
      ],
    });

    const reply = response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

    // Truncate if too long (safety check)
    const truncatedReply = reply.length > MAX_RESPONSE_LENGTH 
      ? reply.substring(0, MAX_RESPONSE_LENGTH) + "..." 
      : reply;

    return {
      reply: truncatedReply,
      refused: false,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[aiChat] OpenAI API error:", error.message);
    
    // Return friendly fallback message
    return {
      reply: "I'm having trouble processing your request right now. Please try again in a moment, or contact support@subkiller.com if the issue persists.",
      refused: false,
      error: true,
    };
  }
}

