// Gmail scan pipeline: 2-stage approach for speed and recall
// Stage 1: Candidate filter + email cleaner (no AI) - removes noise, extracts relevant billing content
// Stage 2: AI extraction on cleaned text only - faster, more accurate
// - Store subscriptions even with amount=0, failed payments, trials, paused
// - Use concurrency limits for speed (<60s for 200 emails)
// - Incremental scanning using lastScanDate
import { google } from "googleapis";
import { Types } from "mongoose";
import pLimit from "p-limit";
import { getGoogleClient } from "../config/google.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { normalizeAmount, normalizeTextField } from "../utils/normalize.js";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion.js";
import { IgnoredSenderModel } from "../models/IgnoredSender.js";
import { extractSubscription } from "./aiService.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { TransactionModel } from "../models/Transaction.js";
import { ChargeModel } from "../models/Charge.js";
import { ScanSessionModel } from "../models/ScanSession.js";
import { MerchantRuleModel } from "../models/MerchantRule.js";

const INVALID_CLIENT_MSG =
  "Server Google OAuth misconfigured (invalid_client). Check GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI";
const RECONNECT_MSG = "Reconnect Gmail (token expired/revoked)";
const PERMISSION_MSG = "Gmail permissions missing. Please reconnect Gmail.";

function errBlob(err) {
  return `${err?.response?.data?.error || ""} ${
    err?.response?.data?.error_description || ""
  } ${err?.message || ""}`.toLowerCase();
}

function isInvalidClient(err) {
  return errBlob(err).includes("invalid_client");
}

function isInvalidGrant(err) {
  const blob = errBlob(err);
  return (
    blob.includes("invalid_grant") ||
    blob.includes("token has been expired") ||
    blob.includes("token has been revoked") ||
    err?.code === 401
  );
}

function isInsufficientPermission(err) {
  const blob = errBlob(err);
  return blob.includes("insufficient") && blob.includes("permission");
}

export async function clearUserGmailTokens(userId) {
  await UserModel.findByIdAndUpdate(userId, {
    gmailConnected: false,
    gmailTokens: { access: null, refresh: null, expiry: null },
  });
}

// Lightweight health check to detect missing scopes / invalid tokens
export async function ensureGmailHealth(userId) {
  const user = await UserModel.findById(userId);
  if (!user?.gmailTokens?.refresh && !user?.gmailTokens?.access) {
    return { ok: false, reason: "NOT_CONNECTED", clearTokens: false };
  }
  const client = getGoogleClient();
  client.setCredentials({
    access_token: user.gmailTokens.access,
    refresh_token: user.gmailTokens.refresh,
    expiry_date: user.gmailTokens.expiry,
  });
  const gmail = google.gmail({ version: "v1", auth: client });
  try {
    // labels.list will fail if gmail.readonly scope is missing
    await gmail.users.labels.list({ userId: "me", maxResults: 1 });
    return { ok: true };
  } catch (err) {
    if (isInsufficientPermission(err)) {
      // eslint-disable-next-line no-console
      console.warn(
        "[gmail] insufficient permission detected during health check"
      );
      return {
        ok: false,
        reason: "INSUFFICIENT_PERMISSION",
        clearTokens: true,
      };
    }
    if (isInvalidGrant(err)) {
      return { ok: false, reason: "INVALID_GRANT", clearTokens: true };
    }
    if (isInvalidClient(err)) {
      return { ok: false, reason: "INVALID_CLIENT", clearTokens: false };
    }
    return { ok: false, reason: "UNKNOWN", clearTokens: false };
  }
}

export async function exchangeCodeForTokens(code, userId) {
  const client = getGoogleClient();
  const existing = await UserModel.findById(userId);
  // Ensure redirect URI matches the one registered in Google Cloud
  const { tokens } = await client.getToken({
    code,
    redirect_uri: env.googleRedirectUri,
  });
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  if (!profile?.data?.email) {
    throw new Error("Invalid Gmail profile");
  }
  const gmailEmail = profile.data.email;
  await UserModel.findByIdAndUpdate(userId, {
    gmailTokens: {
      access: tokens.access_token,
      // Preserve existing refresh token if Google does not return a new one
      refresh: tokens.refresh_token || existing?.gmailTokens?.refresh,
      expiry: tokens.expiry_date,
    },
    gmailEmail,
    gmailConnected: true,
  });
  // eslint-disable-next-line no-console
  console.log("[gmail] stored tokens for user", userId, "email", gmailEmail);
  return tokens;
}
export async function getAuthorizedGmailClient(userId) {
  const user = await UserModel.findById(userId);
  if (
    !user ||
    !user.gmailTokens ||
    !user.gmailTokens.access ||
    !user.gmailTokens.refresh
  ) {
    throw { status: 401, message: "Gmail not connected" };
  }
  const client = getGoogleClient();
  client.setCredentials({
    access_token: user.gmailTokens.access,
    refresh_token: user.gmailTokens.refresh,
    expiry_date: user.gmailTokens.expiry,
  });
  const gmail = google.gmail({ version: "v1", auth: client });
  const ensureProfile = async () => gmail.users.getProfile({ userId: "me" });
  try {
    await ensureProfile();
  } catch (err) {
    if (isInsufficientPermission(err)) {
      // eslint-disable-next-line no-console
      console.warn("[gmail] insufficient permission during token validation");
      await clearUserGmailTokens(userId);
      throw { status: 401, code: "GMAIL_PERMISSION", message: PERMISSION_MSG };
    }
    if (isInvalidClient(err)) {
      // eslint-disable-next-line no-console
      console.error(
        "[gmail] invalid_client when validating tokens. Check Google OAuth credentials."
      );
      throw { status: 500, message: INVALID_CLIENT_MSG };
    }
    // Try a single refresh if the token is expired/revoked
    if (!isInvalidGrant(err)) throw err;
    // eslint-disable-next-line no-console
    console.warn(
      "[gmail] token validation failed, attempting refresh",
      err?.message
    );
    try {
      const refreshed = await client.refreshAccessToken();
      const credentials = refreshed.credentials;
      client.setCredentials(credentials);
      await UserModel.findByIdAndUpdate(userId, {
        gmailTokens: {
          access: credentials.access_token || user.gmailTokens.access,
          refresh: credentials.refresh_token || user.gmailTokens.refresh,
          expiry: credentials.expiry_date || user.gmailTokens.expiry,
        },
      });
      await ensureProfile();
    } catch (refreshErr) {
      if (isInvalidClient(refreshErr)) {
        // eslint-disable-next-line no-console
        console.error(
          "[gmail] invalid_client during refresh. Check GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI."
        );
        throw { status: 500, message: INVALID_CLIENT_MSG };
      }
      // eslint-disable-next-line no-console
      console.warn(
        "[gmail] token validation failed, reconnect needed",
        refreshErr?.message
      );
      await clearUserGmailTokens(userId);
      throw { status: 401, message: RECONNECT_MSG };
    }
  }
  return gmail;
}

function mapGmailError(err) {
  if (isInsufficientPermission(err)) {
    return {
      status: 401,
      code: "GMAIL_PERMISSION",
      message: PERMISSION_MSG,
      clear: true,
    };
  }
  if (isInvalidGrant(err)) {
    return {
      status: 401,
      code: "GMAIL_OAUTH",
      message: RECONNECT_MSG,
      clear: true,
    };
  }
  if (isInvalidClient(err)) {
    return {
      status: 500,
      code: "GMAIL_OAUTH",
      message: INVALID_CLIENT_MSG,
      clear: false,
    };
  }
  return null;
}
export async function scanGmailAndStore(userId, scanId = null, mode = "fast") {
  const gmail = await getAuthorizedGmailClient(userId);

  // Get user's last scan date for incremental scanning
  const user = await UserModel.findById(userId).lean();
  const lastScanDate = user?.lastScanDate;
  let dateQuery = "newer_than:30d"; // Default to 30 days
  if (lastScanDate) {
    // Use Gmail's after: query for incremental scanning
    const afterDate = new Date(lastScanDate);
    afterDate.setDate(afterDate.getDate() - 1); // Include 1 day overlap to catch edge cases
    const afterStr = afterDate.toISOString().split("T")[0].replace(/-/g, "/");
    dateQuery = `after:${afterStr}`;
  }

  // Create or update scan session if scanId provided
  let scanSession = null;
  if (scanId) {
    scanSession = await ScanSessionModel.findOneAndUpdate(
      { scanId },
      {
        userId,
        scanId,
        status: "running",
        startedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  // Debug mode: scan last N messages regardless of content
  const isDebugMode = mode === "debug";
  let query = "";
  const maxMessages = isDebugMode ? 200 : 200;

  if (isDebugMode) {
    // Debug mode: get last 200 messages with no content filter
    query = "";
  } else {
    // Normal mode: use keyword search
    query = `${dateQuery} (receipt OR invoice OR payment OR charged OR billed OR renewal OR subscription)`;
  }

  // Always log scan start (not just in debug mode)
  // eslint-disable-next-line no-console
  console.log("[gmail] scanGmailAndStore starting", {
    userId,
    scanId,
    mode,
    isDebugMode,
    hasTokens: !!user?.gmailTokens?.access,
    lastScanDate: lastScanDate?.toISOString(),
    query: query || "(debug: no filter)",
    maxResults: maxMessages,
  });

  let allMessages = [];
  let nextPageToken = null;
  let fetchAttempts = 0;
  const maxFetchAttempts = 10; // Prevent infinite loops

  // Fetch messages with pagination
  do {
    try {
      // eslint-disable-next-line no-console
      console.log("[gmail] messages.list call", {
        attempt: fetchAttempts + 1,
        query: query || "(empty - debug mode)",
        maxResults: Math.min(500, maxMessages - allMessages.length),
        includeSpamTrash: true,
        hasPageToken: !!nextPageToken,
      });

      const listParams = {
        userId: "me",
        maxResults: Math.min(500, maxMessages - allMessages.length), // Gmail max is 500
        includeSpamTrash: true,
        pageToken: nextPageToken || undefined,
      };

      // Only add query if not empty (debug mode uses empty query)
      if (query) {
        listParams.q = query;
      }

      const response = await gmail.users.messages.list(listParams);

      const batchMessages = response.data.messages || [];
      allMessages = allMessages.concat(batchMessages);
      nextPageToken = response.data.nextPageToken || null;
      fetchAttempts++;

      // eslint-disable-next-line no-console
      console.log("[gmail] messages.list response", {
        batchCount: batchMessages.length,
        totalSoFar: allMessages.length,
        hasNextPage: !!nextPageToken,
        firstMessageId: batchMessages[0]?.id?.substring(0, 20),
        resultSizeEstimate: response.data.resultSizeEstimate,
      });

      // Stop if we've reached maxMessages or no more pages
      if (allMessages.length >= maxMessages || !nextPageToken) {
        break;
      }
    } catch (err) {
      const mapped = mapGmailError(err);
      if (mapped) {
        if (mapped.clear) await clearUserGmailTokens(userId);
        throw mapped;
      }

      // eslint-disable-next-line no-console
      console.error("[gmail] messages.list error", {
        error: err.message,
        code: err.code,
        attempt: fetchAttempts + 1,
      });

      // If query fails and not debug mode, try simpler fallback
      if (fetchAttempts === 0 && !isDebugMode && query) {
        // eslint-disable-next-line no-console
        console.log("[gmail] Query failed, trying fallback (newer_than:7d)");
        try {
          const fallbackResponse = await gmail.users.messages.list({
            userId: "me",
            maxResults: maxMessages,
            q: "newer_than:7d",
            includeSpamTrash: true,
          });
          allMessages = fallbackResponse.data.messages || [];
          nextPageToken = null;
          // eslint-disable-next-line no-console
          console.log("[gmail] Fallback query succeeded", {
            count: allMessages.length,
          });
          break;
        } catch (fallbackErr) {
          // eslint-disable-next-line no-console
          console.error(
            "[gmail] Fallback query also failed",
            fallbackErr.message
          );
          throw err; // Throw original error
        }
      } else {
        throw err;
      }
    }
  } while (
    nextPageToken &&
    allMessages.length < maxMessages &&
    fetchAttempts < maxFetchAttempts
  );

  const totalMessages = allMessages.length;

  // eslint-disable-next-line no-console
  console.log("[gmail] Total messages fetched", {
    totalMessages,
    fetchAttempts,
    queryUsed: query || "(debug: no filter)",
    mode,
  });
  const scanStartedAt = Date.now();
  let processedMessages = 0;
  const newSubs = [];
  const updatedSubs = [];
  let createdCharges = 0;
  const results = [];
  const previews = [];
  let preFiltered = 0; // Emails rejected by isLikelySubscriptionReceipt
  let aiExtracted = 0; // Emails that passed AI extraction
  let recurringCandidates = 0; // Emails with isRecurringCandidate=true
  let skippedOneTime = 0; // Skipped because billingCycle=one_time
  let skippedPromo = 0; // Skipped because kind=marketing/newsletter
  let foundCandidates = 0; // Review items created
  let pendingReview = 0; // Items pending review
  let verified = 0; // Items verified (from previous scans)
  let declined = 0; // Items declined (from previous scans)

  // Update scan session progress
  const updateScanProgress = async () => {
    if (scanSession) {
      await ScanSessionModel.findByIdAndUpdate(scanSession._id, {
        "progress.totalMessages": totalMessages,
        "progress.processedMessages": processedMessages,
        "progress.foundCandidates": foundCandidates,
        "progress.pendingReview": pendingReview,
        "progress.verified": verified,
        "progress.declined": declined,
      });
    }
  };

  const noiseKeywords =
    /(miles|rewards|points|loyalty|status|tier|elite|flying blue|frequent flyer|mile|bonus|thank you points|credit score|survey|welcome)/i;
  const requiredChargePhrases =
    /(charged|payment|paid|billed|invoice|receipt|order|renewal|auto-renew|subscription|membership|billing statement|your payment|was charged|card on file|processed|order confirmation)/i;
  const failedOrRefundKeywords =
    /(payment failed|failed|declined|was declined|couldn’t be processed|unable to process|unsuccessful|chargeback|refunded|refund|reversed|voided|void|canceled|cancelled|dispute|authorization hold|auth hold)/i;
  const subscriptionSignals =
    /(subscription|renewal|recurring|monthly|annual|yearly|next billing|auto-renew|billed every)/i;
  const promoSignals =
    /(sale|discount|offer|promo|newsletter|unsubscribe|deal|% off|percent off|gift guide|welcome|survey|marketing)/i;
  // Enhanced amount detection: supports currency symbols ($€£), currency codes (USD/EGP/EUR/etc),
  // thousand separators (1,200.00), and generic patterns like "Total: 1,200.00" or "Amount 99.99"
  // This catches receipts that don't use symbol prefixes (e.g., "EGP 1,200", "9.99 USD", "Total: 1,200.00")
  const amountSignals =
    /(\$|€|£)\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl|chf|nzd|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|krw|thb|sgd|hkd|php|idr|myr|vnd)\b\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl|chf|nzd|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|krw|thb|sgd|hkd|php|idr|myr|vnd)\b|\b(total|amount|sum|price|cost|charge|charged|paid|billed|subtotal|grand total)\b[^0-9]{0,20}\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/i;
  const billingSignals =
    /(receipt|invoice|payment|charged|renewal|subscription|membership|billing|your order|payment confirmation|statement|billed)/i;
  const promoReject =
    /(sale|promo|discount|newsletter|offer|% off|deal|gift guide|survey|welcome|unsubscribe|marketing)/i;
  const billingDomains =
    /(stripe|paypal|apple|google|amazon|microsoft|netflix|spotify|adobe)/i;
  const junkMerchants =
    /(starbucks|mcdonald|burger|pizza|uber|lyft|doordash|instacart|airlines|delta|united|ryanair|wizz|hotel|shell|chevron)/i;

  // Compute confidence level (1-5) for review workflow
  // Level 5: High-impact (payment failed + recurring, or amount + recurring)
  // Level 4: Likely subscription but missing fields (recurring keywords but no amount, or trial/paused)
  // Level 3: Ambiguous (money keywords but no clear subscription signals)
  // Level 2: One-time purchase (order confirmation, shipped, delivery)
  // Level 1: Promo/newsletter
  const computeConfidenceLevel = (
    extracted,
    subject,
    from,
    bodyText,
    cleanedBodyText,
    normalizedAmount
  ) => {
    const text = `${subject || ""} ${bodyText || ""}`.toLowerCase();
    let level = 3; // Default ambiguous

    // Level 5: High-impact - always require review
    if (failedOrRefundKeywords.test(text) && subscriptionSignals.test(text)) {
      return 5;
    }
    if (amountSignals.test(text) && subscriptionSignals.test(text)) {
      return 5;
    }
    if (
      extracted.status === "payment_failed" &&
      extracted.kind === "subscription"
    ) {
      return 5;
    }
    if (
      extracted.kind === "subscription" &&
      normalizedAmount > 0 &&
      subscriptionSignals.test(text)
    ) {
      return 5; // Recurring renewal receipts
    }

    // Level 4: Likely subscription but missing key fields
    if (subscriptionSignals.test(text) && !amountSignals.test(text)) {
      return 4;
    }
    if (["trial", "paused", "cancel_soon"].includes(extracted.status)) {
      return 4;
    }
    if (
      extracted.kind === "subscription" &&
      (normalizedAmount === 0 || !normalizedAmount)
    ) {
      return 4; // Subscription but amount missing
    }

    // Level 2: One-time purchase
    if (
      /(order confirmation|shipped|delivery|tracking|your order has been)/i.test(
        text
      )
    ) {
      return 2;
    }
    if (extracted.kind === "one_time_purchase") {
      return 2;
    }

    // Level 1: Promo/newsletter
    if (promoSignals.test(text) && !subscriptionSignals.test(text)) {
      return 1;
    }
    if (extracted.kind === "marketing" || extracted.kind === "newsletter") {
      return 1;
    }

    return level; // 3 = ambiguous
  };

  const normalizeCycle = (cycle) => {
    const val = (cycle || "").toLowerCase();
    if (val.startsWith("month")) return "monthly";
    if (val.startsWith("year")) return "yearly";
    if (val.startsWith("week")) return "weekly";
    if (val === "one_time" || val === "one-time" || val === "one time")
      return "one_time";
    return "unknown";
  };

  const computeMonthlyAmount = (billingCycle, amount) => {
    if (!amount || Number.isNaN(amount)) return 0;
    switch (billingCycle) {
      case "yearly":
        return amount / 12;
      case "weekly":
        return amount * 4.345;
      case "monthly":
        return amount;
      default:
        return 0;
    }
  };

  // Helper to strip HTML tags (basic implementation)
  const stripHtml = (html) => {
    if (!html || typeof html !== "string") return "";
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim();
  };

  // Email cleaner: Remove noise (unsubscribe/footer/legal/tracking) and extract relevant billing content
  // Returns cleaned text capped at maxLength (default 4000 chars)
  const cleanEmailText = (text, maxLength = 4000) => {
    if (!text || typeof text !== "string") return "";

    // Remove common email noise patterns
    const noisePatterns = [
      /unsubscribe.*$/gim, // Unsubscribe links and text
      /view in browser.*$/gim,
      /view this email.*$/gim,
      /privacy policy.*$/gim,
      /terms of service.*$/gim,
      /legal notice.*$/gim,
      /copyright.*$/gim,
      /tracking pixel|tracking code|utm_source|utm_medium|utm_campaign/gi,
      /\[.*?\]/g, // Remove [bracketed] tracking codes
      /https?:\/\/[^\s]+/g, // Remove URLs (keep domain context from sender)
      /sent from.*$/gim,
      /this email was sent to.*$/gim,
    ];

    let cleaned = text;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, " ");
    }

    // Extract lines containing billing keywords, amounts, currency codes, or dates
    const billingKeywords =
      /(receipt|invoice|billed|charged|payment|renewal|subscription|membership|billing|statement|total|amount|price|cost|due|next|renew|plan|trial|paused|failed|declined)/i;
    const amountPattern = amountSignals;
    const datePattern =
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i;

    const lines = cleaned.split(/\n+/).filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length < 10) return false; // Skip very short lines
      return (
        billingKeywords.test(trimmed) ||
        amountPattern.test(trimmed) ||
        datePattern.test(trimmed)
      );
    });

    cleaned = lines.join("\n").replace(/\s+/g, " ").trim();

    // Cap length to reduce AI token usage
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + "...";
    }

    return cleaned;
  };

  // Candidate scoring: Rate email likelihood of being a subscription/receipt (0-1)
  // Higher score = more likely to be a subscription. Only pass to AI if score >= threshold
  const scoreCandidate = (subject, snippet, from, bodyText) => {
    const textBlob = `${subject || ""} ${snippet || ""} ${
      bodyText || ""
    }`.toLowerCase();
    let score = 0;

    // Strong positive signals
    if (billingSignals.test(textBlob)) score += 0.4;
    if (amountSignals.test(textBlob)) score += 0.3;
    if (requiredChargePhrases.test(textBlob)) score += 0.2;
    if (subscriptionSignals.test(textBlob)) score += 0.2;
    if (billingDomains.test(from || "")) score += 0.1;

    // Negative signals (reduce score)
    if (promoSignals.test(textBlob)) score -= 0.5;
    if (noiseKeywords.test(textBlob)) score -= 0.3;

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  };

  // Recursively extract text from email payload parts
  const getBestEmailText = (payload) => {
    if (!payload) return null;

    // If payload has body.data directly (simple message)
    if (payload.body?.data) {
      try {
        return Buffer.from(payload.body.data, "base64").toString();
      } catch (e) {
        return null;
      }
    }

    // If payload has parts, search recursively
    if (payload.parts && Array.isArray(payload.parts)) {
      // First, try to find text/plain
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          try {
            return Buffer.from(part.body.data, "base64").toString();
          } catch (e) {
            // Continue searching
          }
        }
      }

      // If no text/plain, try text/html
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          try {
            const html = Buffer.from(part.body.data, "base64").toString();
            return stripHtml(html);
          } catch (e) {
            // Continue searching
          }
        }
      }

      // Recursively search nested parts (multipart/alternative, etc.)
      for (const part of payload.parts) {
        if (part.parts && Array.isArray(part.parts)) {
          const nested = getBestEmailText(part);
          if (nested) return nested;
        }
      }
    }

    return null;
  };

  // SOFT PRE-FILTER: Only reject emails that clearly cannot be receipts
  // Softened: Only skip if it has NO billing keywords AND NO amount AND NO subscription signals
  const isLikelySubscriptionReceipt = ({
    subject,
    snippet,
    from,
    bodyText,
  }) => {
    const textBlob = `${subject || ""} ${snippet || ""} ${
      bodyText || ""
    }`.toLowerCase();

    // Check for any billing/receipt/subscription signals
    const hasAmount = amountSignals.test(textBlob);
    const hasBillingSignal = billingSignals.test(textBlob);
    const hasChargePhrase = requiredChargePhrases.test(textBlob);
    const hasSubscriptionSignal = subscriptionSignals.test(textBlob);

    // Only reject if it has NONE of these signals (very unlikely to be a receipt)
    // This is much softer - we let AI handle most filtering
    if (
      !hasAmount &&
      !hasBillingSignal &&
      !hasChargePhrase &&
      !hasSubscriptionSignal
    ) {
      if (process.env.LOG_SCAN_REJECTS === "true") {
        // eslint-disable-next-line no-console
        console.log(
          "REJECT_EMAIL_SUB: NO_BILLING_SIGNALS (isLikelySubscriptionReceipt)",
          {
            subject,
            from,
            snippet: (snippet || "").substring(0, 120),
          }
        );
      }
      return false;
    }

    // Pass through to AI extraction
    return true;
  };

  // Decide if an extracted email truly represents a subscription (not necessarily paid).
  // We separate subscription presence from paid charges - subscriptions can be $0, trial, or failed.
  const isValidSubscription = (extracted, meta) => {
    const service = normalizeTextField(extracted.service);
    const amt = normalizeAmount(extracted.amount);
    const subjectText = (meta.subject || "").toLowerCase();
    const fromText = (meta.from || "").toLowerCase();
    const snippetText = (meta.snippet || "").toLowerCase();
    const bodyText = (meta.bodyText || "").toLowerCase();

    const reject = (reason) => {
      // eslint-disable-next-line no-console
      console.log("[gmail] reject", {
        reason,
        service,
        amount: amt,
        subject: meta.subject,
      });
      return false;
    };

    // Include bodyText in blob for validation (more comprehensive check)
    const blob = `${subjectText} ${snippetText} ${bodyText}`;
    if (!billingSignals.test(blob) || promoReject.test(blob))
      return reject("NO_BILLING_SIGNAL");
    if (!billingDomains.test(fromText) && !service)
      return reject("NO_BILLING_DOMAIN");
    if (!service) return reject("MISSING_SERVICE");
    // REMOVED: amount > 0 requirement - we'll handle this separately with isPaidCharge
    if (
      noiseKeywords.test(subjectText) ||
      noiseKeywords.test(fromText) ||
      noiseKeywords.test(snippetText) ||
      noiseKeywords.test(bodyText)
    )
      return reject("LOYALTY_OR_NOISE");
    // Note: We don't reject failed payments here - they can still be valid subscriptions
    // Failed payment detection happens later to determine if we create a charge
    if (
      !requiredChargePhrases.test(subjectText) &&
      !requiredChargePhrases.test(snippetText) &&
      !requiredChargePhrases.test(bodyText)
    )
      return reject("NO_CHARGE_PHRASE");
    return true;
  };
  // Concurrency limits for speed: process 5 messages + AI calls in parallel
  const limit = pLimit(5);
  let filteredOut = 0;
  let skippedIdempotent = 0; // Messages skipped because Transaction/Charge already exists

  // Get merchant rules for this user to boost confidence
  const merchantRules = await MerchantRuleModel.find({ userId }).lean();
  const merchantRuleMap = new Map();
  for (const rule of merchantRules) {
    merchantRuleMap.set(rule.domain.toLowerCase(), rule);
  }

  // Process messages in parallel with concurrency limit
  const processMessage = async (msg) => {
    // Idempotency check: Skip if Transaction or Charge already exists for this gmailMessageId
    if (msg.id) {
      const existingTx = await TransactionModel.findOne({
        userId,
        gmailMessageId: msg.id,
      });
      const existingCharge = await ChargeModel.findOne({
        userId,
        gmailMessageId: msg.id,
      });
      if (existingTx || existingCharge) {
        skippedIdempotent += 1;
        if (process.env.LOG_SCAN_REJECTS === "true") {
          // eslint-disable-next-line no-console
          console.log("SKIP_IDEMPOTENT: Already processed", {
            gmailMessageId: msg.id,
            hasTransaction: !!existingTx,
            hasCharge: !!existingCharge,
          });
        }
        return;
      }
    }

    let message;
    try {
      message = await gmail.users.messages.get({
        userId: "me",
        id: msg.id || "",
      });
    } catch (err) {
      const mapped = mapGmailError(err);
      if (mapped) {
        if (mapped.clear) await clearUserGmailTokens(userId);
        throw mapped;
      }
      throw err;
    }
    const headers = message.data.payload?.headers || [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ??
      undefined;
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? undefined;
    if (from) {
      const ignored = await IgnoredSenderModel.findOne({
        user: userId,
        sender: from,
      });
      if (ignored) {
        // eslint-disable-next-line no-console
        console.log("[gmail] Skipping ignored sender", from);
        return;
      }
    }

    // Stage 1: Extract and clean email text
    const rawBodyText =
      getBestEmailText(message.data.payload) || message.data.snippet || "";
    const cleanedBodyText = cleanEmailText(rawBodyText, 4000);
    const snippet = message.data.snippet || "";

    // Stage 1: Candidate scoring - only proceed to AI if score >= threshold
    const candidateScore = scoreCandidate(
      subject,
      snippet,
      from,
      cleanedBodyText
    );
    const CANDIDATE_THRESHOLD = 0.1; // Lowered threshold - prefilter already handles basic filtering

    if (candidateScore < CANDIDATE_THRESHOLD) {
      filteredOut += 1;
      preFiltered += 1;
      if (process.env.LOG_SCAN_REJECTS === "true") {
        // eslint-disable-next-line no-console
        console.log("REJECT_CANDIDATE_SCORE: Score too low", {
          subject,
          from,
          score: candidateScore.toFixed(2),
          threshold: CANDIDATE_THRESHOLD,
        });
      }
      return;
    }

    // Log when message passes candidate filter (for debugging)
    if (process.env.LOG_SCAN_REJECTS === "true") {
      // eslint-disable-next-line no-console
      console.log("PASS_CANDIDATE_FILTER: Proceeding to AI extraction", {
        subject,
        from,
        score: candidateScore.toFixed(2),
        snippet: snippet.substring(0, 120),
      });
    }

    // Stage 2: AI extraction on cleaned text only (faster, more accurate)
    const extracted = await extractSubscription({
      text: cleanedBodyText, // Use cleaned text instead of raw
      subject,
      from,
      snippet,
    });
    if (!extracted) {
      return;
    }
    aiExtracted += 1;

    // Rule-based overrides for promo/marketing subjects
    const promoPattern =
      /(percent off|% off|off for life|discount|offer|sale|gift guide|deal|promo|holiday|special offer|save)/i;
    const chargePattern =
      /(receipt|invoice|charged|payment|billed|renewal|renews|subscription|membership|your plan|premium)/i;
    const subjectText = subject || "";
    // Known merchant recall boost
    const knownMerchants = [
      {
        domain: /spotify\.com/i,
        hints: /(receipt|payment|premium|subscription|plan|membership)/i,
        service: "Spotify",
      },
      {
        domain: /netflix\.com/i,
        hints: /(receipt|payment|subscription|membership|renewal)/i,
        service: "Netflix",
      },
      {
        domain: /hulu\.com/i,
        hints: /(receipt|payment|subscription|membership|renewal)/i,
        service: "Hulu",
      },
      {
        domain: /apple\.com/i,
        hints: /(receipt|subscription|payment|invoice|itunes|app store)/i,
        service: "Apple",
      },
      {
        domain: /patreon\.com/i,
        hints: /(receipt|payment|membership|patron)/i,
        service: "Patreon",
      },
      {
        domain: /discord\.com/i,
        hints: /(nitro|subscription|payment|receipt|invoice)/i,
        service: "Discord",
      },
    ];
    const fromMatches = (regex) => (from ? regex.test(from) : false);
    const subjectMatches = (regex) => (subject ? regex.test(subject) : false);
    const merchantHit = knownMerchants.find(
      (m) => fromMatches(m.domain) && subjectMatches(m.hints)
    );
    if (merchantHit && extracted.kind !== "subscription") {
      extracted.kind = "subscription";
      if (!extracted.service) extracted.service = merchantHit.service;
    }
    // Promo override
    if (promoPattern.test(subjectText) && !chargePattern.test(subjectText)) {
      extracted.kind = "marketing";
      // eslint-disable-next-line no-console
      console.log(
        `[gmail] Forced non-subscription due to promo subject: subject=${subjectText}`
      );
    }
    // Amount zero and promo-looking subject should be non-subscription
    if (
      (extracted.kind === "subscription" || extracted.kind === "other") &&
      Number(extracted.amount || 0) === 0
    ) {
      if (promoPattern.test(subjectText) && !chargePattern.test(subjectText)) {
        extracted.kind = "marketing";
        // eslint-disable-next-line no-console
        console.log(
          `[gmail] Forced non-subscription due to zero-amount promo: subject=${subjectText}`
        );
      }
    }
    // NEW ACCEPTANCE RULES: Store subscriptions even when:
    // - kind is subscription OR status indicates ongoing plan (trial/paused/payment_failed/cancel_soon)
    // - amount is 0 but recurring price exists in text
    // - payment failed -> create/update subscription with status="payment_failed"

    // Check if this is a subscription candidate (even if kind is not "subscription")
    const isSubscriptionCandidate =
      extracted.kind === "subscription" ||
      extracted.status === "trial" ||
      extracted.status === "paused" ||
      extracted.status === "payment_failed" ||
      extracted.status === "cancel_soon" ||
      /subscription|recurring|renewal|membership|plan|trial|paused/i.test(
        cleanedBodyText.toLowerCase()
      );

    // If not a subscription candidate and not a subscription kind, create suggestion instead of skipping
    if (!isSubscriptionCandidate && extracted.kind !== "subscription") {
      if (process.env.LOG_SCAN_REJECTS === "true") {
        // eslint-disable-next-line no-console
        console.log("REJECT_NOT_SUBSCRIPTION_CANDIDATE: Creating suggestion", {
          subject,
          from,
          kind: extracted.kind,
          status: extracted.status,
        });
      }

      // Create suggestion for borderline cases
      try {
        await PendingSubscriptionSuggestionModel.findOneAndUpdate(
          { user: userId, gmailMessageId: msg.id || "" },
          {
            user: new Types.ObjectId(userId),
            gmailMessageId: msg.id || "",
            subject: subject || "",
            from: from || "",
            service: extracted.service || null,
            amount: normalizeAmount(extracted.amount) || 0,
            currency: extracted.currency || "USD",
            category: extracted.category || "Other",
            kind: extracted.kind || "other",
            confidence: candidateScore, // Use candidate score as confidence
            needsReview: true, // Flag for manual review
            lastSeenAt: new Date(),
            status: "pending",
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        // Ignore duplicate key errors
        if (err.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error("[gmail] Failed to create suggestion:", err.message);
        }
      }
      return;
    }
    const normalizedAmount = normalizeAmount(extracted.amount) || 0;
    const serviceText = normalizeTextField(extracted.service);
    const normalizedService = serviceText
      ? serviceText.trim().toLowerCase()
      : null;
    const normalizedCategory =
      normalizeTextField(extracted.category) || "Other";

    if (!normalizedService) {
      // eslint-disable-next-line no-console
      console.warn(
        "[gmail] Skipping subscription due to invalid service",
        extracted.service
      );
      return;
    }

    const subjectTextLower = (subject || "").toLowerCase();
    const snippetLower = (message.data.snippet || "").toLowerCase();
    const bodyTextLower = (rawBodyText || "").toLowerCase();
    const billingCycle = normalizeCycle(extracted.billingCycle);
    const chargeDate = extracted.chargeDate
      ? new Date(extracted.chargeDate)
      : message.data.internalDate
      ? new Date(Number(message.data.internalDate))
      : new Date();

    // Determine if this is a recurring subscription candidate
    const isRecurringCandidate =
      billingCycle !== "one_time" &&
      billingCycle !== "unknown" &&
      (extracted.kind === "subscription" ||
        billingCycle === "monthly" ||
        billingCycle === "yearly" ||
        billingCycle === "weekly" ||
        /subscription|recurring|renewal|monthly|annual|yearly/i.test(
          bodyTextLower
        ));

    // Determine if this is a successful paid charge
    const isPaidCharge =
      normalizedAmount > 0 &&
      !failedOrRefundKeywords.test(subjectTextLower) &&
      !failedOrRefundKeywords.test(snippetLower) &&
      !failedOrRefundKeywords.test(bodyTextLower);

    const isFailed =
      failedOrRefundKeywords.test(subjectTextLower) ||
      failedOrRefundKeywords.test(snippetLower) ||
      failedOrRefundKeywords.test(bodyTextLower);
    if (junkMerchants.test(normalizedService) && !isFailed) {
      // Try serviceNormalized first, then fallback to legacy service match
      let existing = await SubscriptionModel.findOne({
        userId,
        serviceNormalized: normalizedService,
        totalCharges: { $gte: 2 },
      });
      // Fallback: try legacy match for old records
      if (!existing) {
        existing = await SubscriptionModel.findOne({
          userId,
          service: {
            $regex: new RegExp(
              `^${normalizedService.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i"
            ),
          },
          totalCharges: { $gte: 2 },
        });
      }
      if (!existing) {
        filteredOut += 1;
        if (process.env.LOG_SCAN_REJECTS === "true") {
          // eslint-disable-next-line no-console
          console.log(
            "REJECT_JUNK_MERCHANT: No existing subscription with 2+ charges",
            {
              service: normalizedService,
            }
          );
        }
        return;
      }
    }

    // Note: monthlyAmount will be computed later using finalAmount
    if (
      !isValidSubscription(
        {
          ...extracted,
          service: normalizedService,
          amount: normalizedAmount,
          billingCycle,
        },
        { subject, from, snippet, bodyText: cleanedBodyText }
      )
    ) {
      // eslint-disable-next-line no-console
      console.log("[gmail] Rejected noisy/invalid email", {
        subject,
        from,
        amount: normalizedAmount,
      });
      return;
    }

    // Create/update subscription if it's a recurring candidate (even with $0 or failed payment)
    if (!isRecurringCandidate) {
      skippedOneTime += 1;
      if (process.env.LOG_SCAN_REJECTS === "true") {
        // eslint-disable-next-line no-console
        console.log("REJECT_NOT_RECURRING: Creating suggestion", {
          service: normalizedService,
          billingCycle,
          kind: extracted.kind,
          status: extracted.status,
        });
      }

      // Create suggestion for borderline cases
      try {
        await PendingSubscriptionSuggestionModel.findOneAndUpdate(
          { user: userId, gmailMessageId: msg.id || "" },
          {
            user: new Types.ObjectId(userId),
            gmailMessageId: msg.id || "",
            subject: subject || "",
            from: from || "",
            service: normalizedService,
            amount: normalizedAmount,
            currency: extracted.currency || "USD",
            category: normalizedCategory,
            kind: extracted.kind || "other",
            confidence: candidateScore,
            needsReview: true,
            lastSeenAt: new Date(),
            status: "pending",
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        if (err.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error("[gmail] Failed to create suggestion:", err.message);
        }
      }
      return;
    }

    // Skip if kind is marketing/newsletter (strong promo rejection)
    if (extracted.kind === "marketing" || extracted.kind === "newsletter") {
      skippedPromo += 1;
      if (process.env.LOG_SCAN_REJECTS === "true") {
        // eslint-disable-next-line no-console
        console.log("REJECT_MARKETING: Skipping marketing/newsletter", {
          service: normalizedService,
          kind: extracted.kind,
        });
      }
      return;
    }

    recurringCandidates += 1;

    // Compute confidence level for review workflow
    const confidenceLevel = computeConfidenceLevel(
      extracted,
      subject,
      from,
      rawBodyText,
      cleanedBodyText,
      normalizedAmount
    );

    // Determine subscription status
    let subscriptionStatus = extracted.status || "active";
    let finalAmount = normalizedAmount;
    let needsReview = false;

    if (isFailed) {
      subscriptionStatus = "payment_failed"; // New status for failed payments
    } else if (normalizedAmount === 0) {
      // Try to extract recurring price from text (e.g., "you will be charged $11.99 every month")
      const recurringPriceMatch = cleanedBodyText.match(
        /(?:will be charged|charged|billed|price|cost|rate|plan|subscription).*?(\$|€|£|usd|egp|eur|gbp)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i
      );
      if (recurringPriceMatch && recurringPriceMatch[3]) {
        const extractedPrice = parseFloat(
          recurringPriceMatch[3].replace(/,/g, "")
        );
        if (extractedPrice > 0) {
          finalAmount = extractedPrice;
          if (process.env.LOG_SCAN_REJECTS === "true") {
            // eslint-disable-next-line no-console
            console.log("EXTRACTED_RECURRING_PRICE: Found price in text", {
              service: normalizedService,
              extractedPrice,
              originalAmount: normalizedAmount,
            });
          }
        }
      }

      // $0 subscriptions are likely trials or paused
      if (extracted.status === "trial" || /trial|free/i.test(bodyTextLower)) {
        subscriptionStatus = "trial";
      } else if (extracted.status === "paused") {
        subscriptionStatus = "paused";
      } else if (finalAmount === 0) {
        // Still $0 after extraction - mark for review
        needsReview = true;
        subscriptionStatus = "active"; // Default for $0 subscriptions
      }
    }

    // Update isPaidCharge based on finalAmount
    const isPaidChargeFinal =
      finalAmount > 0 &&
      !failedOrRefundKeywords.test(subjectTextLower) &&
      !failedOrRefundKeywords.test(snippetLower) &&
      !failedOrRefundKeywords.test(bodyTextLower);

    // Update allowedStatuses to include payment_failed
    const allowedStatuses = [
      "active",
      "trial",
      "cancel_soon",
      "canceled",
      "paused",
      "payment_failed",
    ];
    subscriptionStatus = allowedStatuses.includes(subscriptionStatus)
      ? subscriptionStatus
      : "active";

    // Determine if we should create a review item based on mode and confidence level
    // Fast mode: only levels 4-5, Strict mode: levels 3-5, Show all: levels 1-5
    const shouldCreateReviewItem =
      mode === "fast"
        ? confidenceLevel >= 4
        : mode === "strict"
        ? confidenceLevel >= 3
        : confidenceLevel >= 1; // Show all

    // For levels 1-2, auto-decline if not in "show all" mode
    if (confidenceLevel <= 2 && mode !== "show_all") {
      // Auto-decline: create review item with decision="declined"
      try {
        await PendingSubscriptionSuggestionModel.findOneAndUpdate(
          { user: userId, gmailMessageId: msg.id || "" },
          {
            user: new Types.ObjectId(userId),
            gmailMessageId: msg.id || "",
            gmailThreadId: message.data.threadId || "",
            subject: subject || "",
            from: from || "",
            date: chargeDate,
            service: normalizedService,
            amount: finalAmount,
            currency: extracted.currency || "USD",
            category: normalizedCategory,
            kind: extracted.kind || "other",
            confidence: candidateScore,
            confidenceLevel,
            decision: "declined",
            decisionMeta: {
              decidedAt: new Date(),
              autoDeclined: true,
              reason: `Level ${confidenceLevel} - auto-declined in ${mode} mode`,
            },
            cleanedPreview: cleanedBodyText.substring(0, 500), // First ~30 lines
            aiExtracted: extracted,
            needsReview: false,
            lastSeenAt: new Date(),
            status: "ignored",
          },
          { upsert: true, new: true }
        );
        declined += 1;
        await updateScanProgress();
      } catch (err) {
        if (err.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error(
            "[gmail] Failed to create auto-declined item:",
            err.message
          );
        }
      }
      return;
    }

    // Create review item for levels 3-5 (or based on mode)
    if (shouldCreateReviewItem) {
      try {
        const reviewItem =
          await PendingSubscriptionSuggestionModel.findOneAndUpdate(
            { user: userId, gmailMessageId: msg.id || "" },
            {
              user: new Types.ObjectId(userId),
              gmailMessageId: msg.id || "",
              gmailThreadId: message.data.threadId || "",
              subject: subject || "",
              from: from || "",
              date: chargeDate,
              service: normalizedService,
              amount: finalAmount,
              currency: extracted.currency || "USD",
              category: normalizedCategory,
              kind: extracted.kind || "other",
              confidence: candidateScore,
              confidenceLevel,
              decision: "pending",
              cleanedPreview: cleanedBodyText.substring(0, 500), // First ~30 lines
              aiExtracted: extracted,
              needsReview: confidenceLevel >= 4,
              lastSeenAt: new Date(),
              status: "pending",
            },
            { upsert: true, new: true }
          );
        foundCandidates += 1;
        pendingReview += 1;
        await updateScanProgress();
      } catch (err) {
        if (err.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error("[gmail] Failed to create review item:", err.message);
        }
      }
    }

    results.push({ gmailMessageId: msg.id || "" });

    const estimatedMonthlySpend = monthlyAmount;
    const nextRenewal = new Date(chargeDate);
    if (billingCycle === "yearly") {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
    } else {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    }

    // Try to find subscription by serviceNormalized first
    let subscription = await SubscriptionModel.findOne({
      userId,
      serviceNormalized: normalizedService,
    });

    // Fallback: if not found, try legacy match on service (for old records)
    if (!subscription) {
      const legacyMatch = await SubscriptionModel.findOne({
        userId,
        service: {
          $regex: new RegExp(
            `^${normalizedService.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        },
        $or: [
          { serviceNormalized: { $exists: false } },
          { serviceNormalized: null },
          { serviceNormalized: "" },
        ],
      });
      if (legacyMatch) {
        // Update legacy record with serviceNormalized
        legacyMatch.serviceNormalized = normalizedService;
        await legacyMatch.save();
        subscription = legacyMatch;
      }
    }

    if (!subscription) {
      // No longer require multiple occurrences - create subscription from single email if valid
      try {
        subscription = await SubscriptionModel.create({
          userId,
          service: serviceText, // Human-readable name
          serviceNormalized: normalizedService, // Normalized for queries
          category: normalizedCategory,
          amount: normalizedAmount || 0, // Allow 0
          monthlyAmount: monthlyAmount || 0,
          estimatedMonthlySpend: monthlyAmount || 0,
          totalAmount: isPaidCharge ? normalizedAmount : 0, // Only count paid charges
          totalCharges: isPaidCharge ? 1 : 0, // Only count paid charges
          currency: extracted.currency || "USD",
          billingCycle,
          nextRenewal,
          lastChargeAt: isPaidChargeFinal ? chargeDate : undefined, // Only set if paid
          status: subscriptionStatus, // Use computed status
          firstDetectedAt: new Date(),
        });
        newSubs.push(normalizedService);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[gmail] Failed to create subscription:", {
          error: err.message,
          errors: err.errors,
          service: serviceText,
          serviceNormalized: normalizedService,
          userId,
        });
        throw err;
      }
    } else {
      // Update existing subscription
      subscription.amount = normalizedAmount || subscription.amount || 0;
      subscription.monthlyAmount =
        monthlyAmount || subscription.monthlyAmount || 0;
      subscription.estimatedMonthlySpend =
        monthlyAmount || subscription.estimatedMonthlySpend || 0;

      // Only update totals if this is a paid charge
      if (isPaidCharge) {
        subscription.totalAmount =
          (subscription.totalAmount || 0) + normalizedAmount;
        subscription.totalCharges = (subscription.totalCharges || 0) + 1;
        subscription.lastChargeAt = chargeDate;
      }

      subscription.category = normalizedCategory;
      subscription.currency =
        extracted.currency || subscription.currency || "USD";
      subscription.billingCycle = billingCycle;
      subscription.status = subscriptionStatus; // Update status
      subscription.nextRenewal = nextRenewal;
      try {
        await subscription.save();
        updatedSubs.push(normalizedService);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[gmail] Failed to save subscription update:", {
          error: err.message,
          errors: err.errors,
          service: serviceText,
          serviceNormalized: normalizedService,
          subscriptionId: subscription._id,
          userId,
        });
        throw err;
      }
    }

    // Create transaction only for paid charges
    if (msg.id && isPaidChargeFinal) {
      const existsTx = await TransactionModel.findOne({
        userId,
        gmailMessageId: msg.id,
      });
      if (!existsTx) {
        await TransactionModel.create({
          userId,
          subscriptionId: subscription ? subscription.id : undefined,
          service: normalizedService,
          amount: finalAmount,
          currency: extracted.currency || "USD",
          billingCycle,
          chargedAt: chargeDate,
          gmailMessageId: msg.id,
          gmailThreadId: message.data.threadId || "",
          description: subject || normalizedService || "Receipt",
        });
      }
    }

    // Create charge record only for paid charges
    if (msg.id && isPaidChargeFinal && subscription) {
      const existsCharge = await ChargeModel.findOne({
        userId,
        gmailMessageId: msg.id,
        subscriptionId: subscription.id,
      });
      if (!existsCharge) {
        await ChargeModel.create({
          userId,
          subscriptionId: subscription.id,
          service: normalizedService,
          amount: finalAmount,
          currency: extracted.currency || "USD",
          billingCycle,
          chargedAt: chargeDate,
          gmailMessageId: msg.id || "",
          gmailThreadId: message.data.threadId || "",
          subject: subject || normalizedService || "Receipt",
          from: from || "",
          status: "paid", // Always "paid" since isPaidCharge already filtered failures
        });
        createdCharges += 1;
      }
    }

    previews.push({
      id: msg.id || "",
      from: from || "",
      subject: subject || normalizedService || "Receipt",
      amount: finalAmount ?? 0,
      currency: extracted.currency || "USD",
      billingCycle,
      chargedAt: chargeDate,
      status: subscriptionStatus,
      needsReview,
    });
    processedMessages += 1;
  };

  // Process all messages in parallel with concurrency limit
  // Add periodic progress logging
  const progressInterval = setInterval(() => {
    // eslint-disable-next-line no-console
    console.log("[gmail] scan progress", {
      processed: processedMessages,
      total: totalMessages,
      preFiltered,
      aiExtracted,
      foundCandidates,
      pendingReview,
      verified,
      declined,
    });
  }, 5000); // Log every 5 seconds

  try {
    await Promise.all(
      allMessages.map((msg) => limit(() => processMessage(msg)))
    );
  } finally {
    clearInterval(progressInterval);
  }

  await UserModel.findByIdAndUpdate(userId, { lastScanDate: new Date() });
  const durationMs = Date.now() - scanStartedAt;

  // Update scan session to completed
  if (scanSession) {
    await ScanSessionModel.findByIdAndUpdate(scanSession._id, {
      status: "completed",
      completedAt: new Date(),
      "progress.totalMessages": totalMessages,
      "progress.processedMessages": processedMessages,
      "progress.foundCandidates": foundCandidates,
      "progress.pendingReview": pendingReview,
      "progress.verified": verified,
      "progress.declined": declined,
    });
  }

  const stats = {
    totalMessages,
    processedMessages,
    createdSubscriptions: newSubs.length + updatedSubs.length,
    createdCharges,
    foundCandidates,
    pendingReview,
    durationMs,
    avgMsPerMessage: totalMessages ? durationMs / totalMessages : 0,
  };

  // Always log scan results summary with all counters
  // eslint-disable-next-line no-console
  console.log("[gmail] scan complete", {
    userId,
    scanId,
    mode,
    totalMessages,
    processedMessages,
    preFiltered,
    skippedIdempotent,
    aiExtracted,
    recurringCandidates,
    createdSubscriptions: newSubs.length + updatedSubs.length,
    newSubscriptions: newSubs.length,
    updatedSubscriptions: updatedSubs.length,
    createdCharges,
    foundCandidates,
    pendingReview,
    verified,
    declined,
    skippedOneTime,
    skippedPromo,
    durationMs: `${Math.round(durationMs)}ms`,
    avgMsPerMessage: totalMessages
      ? `${Math.round(durationMs / totalMessages)}ms`
      : "N/A",
    speed:
      totalMessages > 0
        ? `${Math.round((totalMessages / durationMs) * 1000)} emails/sec`
        : "N/A",
  });

  if (process.env.LOG_SCAN_REJECTS === "true") {
    // eslint-disable-next-line no-console
    console.log("[gmail] scan detailed stats", {
      totalMessages,
      preFiltered,
      aiExtracted,
      recurringCandidates,
      processedMessages,
      filteredOut,
      createdSubscriptions: newSubs.length + updatedSubs.length,
      newSubscriptions: newSubs.length,
      updatedSubscriptions: updatedSubs.length,
      createdCharges,
      skippedOneTime,
      skippedPromo,
      newSubs: newSubs.slice(0, 10), // First 10 new subscriptions
      updatedSubs: updatedSubs.slice(0, 10), // First 10 updated subscriptions
    });
  }

  return { results, previews: previews.slice(-20), stats };
}
