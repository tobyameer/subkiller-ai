// Gmail scan pipeline V2: Improved recall with PDF extraction and presence detection
// - No keyword search filtering (uses date-based incremental scanning)
// - Extracts text from email bodies AND PDF attachments
// - Separates subscription presence from charge creation
// - Always creates subscriptions when detected (even amount=0, trial, payment_failed)
// - Only creates charges when amount>0 and payment succeeded
import { google } from "googleapis";
import { Types } from "mongoose";
import pLimit from "p-limit";
import { getGoogleClient } from "../config/google.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { normalizeAmount, normalizeTextField } from "../utils/normalize.js";
import { canonicalizeService, detectProvider } from "../utils/canonicalize.js";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion.js";
import { IgnoredSenderModel } from "../models/IgnoredSender.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { TransactionModel } from "../models/Transaction.js";
import { ChargeModel } from "../models/Charge.js";
import { ScanSessionModel } from "../models/ScanSession.js";
import { MerchantRuleModel } from "../models/MerchantRule.js";
import { fetchMessageIds } from "./gmailFetch.js";
import { getBestEmailText } from "../utils/emailText.js";
import { extractPdfTexts } from "./gmailAttachments.js";
import { detectSubscriptionPresence } from "./subscriptionPresence.js";
import { orchestrateExtraction } from "./extractionOrchestrator.js";
import {
  extractAmountAndCurrency,
  extractBillingCycle,
} from "./receiptParser.js";

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

  // Always log scan start
  // eslint-disable-next-line no-console
  console.log("[gmail] scanGmailAndStore V2 starting", {
    userId,
    scanId,
    mode,
    hasTokens: !!user?.gmailTokens?.access,
    lastScanDate: lastScanDate?.toISOString(),
  });

  // Fetch message IDs using new module (no keyword filtering)
  const allMessages = await fetchMessageIds({
    gmail,
    maxMessages: 200,
    lastScanDate,
    mode,
  });

  const totalMessages = allMessages.length;

  // eslint-disable-next-line no-console
  console.log("[gmail] Total messages fetched", {
    totalMessages,
    mode,
  });
  const scanStartedAt = Date.now();
  let processedMessages = 0;
  const newSubs = [];
  const updatedSubs = [];
  let createdCharges = 0;
  const results = [];
  const previews = [];
  let pdfParsedCount = 0; // PDFs successfully parsed
  let presenceTrueCount = 0; // Emails with subscription presence detected
  let aiCalledCount = 0; // AI extraction calls made
  let subsUpsertedCount = 0; // Subscriptions created/updated
  let chargesCreatedCount = 0; // Charges created
  let foundCandidates = 0; // Review items created
  let pendingReview = 0; // Items pending review
  let verified = 0; // Items verified (from previous scans)
  let declined = 0; // Items declined (from previous scans)
  let skippedIdempotent = 0; // Messages skipped because already processed
  let skippedNoPresence = 0; // Messages skipped because no subscription presence

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

  // Process messages in parallel with concurrency limit
  const limit = pLimit(5);

  const processMessage = async (msg) => {
    // Idempotency check: Skip if Transaction or Charge already exists
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
        processedMessages += 1;
        await updateScanProgress();
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
    const snippet = message.data.snippet || "";

    // Check ignored senders
    if (from) {
      const ignored = await IgnoredSenderModel.findOne({
        user: userId,
        sender: from,
      });
      if (ignored) {
        processedMessages += 1;
        await updateScanProgress();
        return;
      }
    }

    // Extract email body text
    const bodyText = getBestEmailText(message.data.payload) || snippet;

    // Check for PDF attachments before extraction
    const { listAttachments } = await import("./gmailAttachments.js");
    const attachments = listAttachments(message.data.payload);
    const hasPdfAttachment = attachments.some(
      (att) =>
        att.mimeType === "application/pdf" ||
        att.filename?.toLowerCase().endsWith(".pdf")
    );

    // Extract PDF text from attachments
    let pdfText = "";
    try {
      pdfText = await extractPdfTexts(gmail, msg.id, message.data.payload, 8000);
      if (pdfText) {
        pdfParsedCount += 1;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[gmail] PDF extraction failed", {
        messageId: msg.id?.substring(0, 20),
        error: err.message,
      });
    }

    // Detect subscription presence (no AI) - includes PDF attachment boost
    const presenceResult = detectSubscriptionPresence({
      subject,
      from,
      snippet,
      bodyText,
      pdfText,
      hasPdfAttachment,
    });

    if (!presenceResult.presence) {
      skippedNoPresence += 1;
      processedMessages += 1;
      await updateScanProgress();
      return;
    }

    presenceTrueCount += 1;

    // Run AI extraction (only if presence detected)
    let extracted;
    try {
      extracted = await orchestrateExtraction({
        subject,
        from,
        snippet,
        bodyText,
        pdfText,
      });
      aiCalledCount += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[gmail] AI extraction failed", {
        messageId: msg.id?.substring(0, 20),
        error: err.message,
      });
      processedMessages += 1;
      await updateScanProgress();
      return;
    }

    // Canonicalize and normalize service name
    const rawService = extracted.service || extracted.service_canonical;
    let canonicalService = extracted.service_canonical 
      ? extracted.service_canonical 
      : canonicalizeService(rawService);
    
    // Detect provider if not provided by AI
    const provider = extracted.provider || detectProvider(from) || "direct";
    
    // Use canonical service for display, normalize for key
    let serviceDisplay = canonicalService || rawService;
    
    if (!serviceDisplay) {
      // Try to infer from sender domain
      const domainMatch = from?.match(/@([a-z0-9.-]+)\./i);
      if (domainMatch) {
        const domain = domainMatch[1];
        const inferredService = domain
          .split(".")
          .filter((p) => p && p !== "com" && p !== "net" && p !== "co")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");
        if (inferredService) {
          serviceDisplay = canonicalizeService(inferredService);
          canonicalService = serviceDisplay;
        }
      }
      if (!serviceDisplay) {
        processedMessages += 1;
        await updateScanProgress();
        return;
      }
    }
    
    // Normalize for database key
    const normalizedService = normalizeTextField(serviceDisplay)?.trim().toLowerCase();
    if (!normalizedService) {
      processedMessages += 1;
      await updateScanProgress();
      return;
    }

    const normalizedAmount = normalizeAmount(extracted.amount) || 0;
    const normalizedCategory =
      normalizeTextField(extracted.category) || "Other";
    // Use canonical service for display
    const serviceText = serviceDisplay;

    // Determine billing cycle
    let billingCycle = extracted.billingCycle || "unknown";
    if (billingCycle === "unknown") {
      const fullText = `${bodyText} ${pdfText}`;
      const parsedCycle = extractBillingCycle(fullText);
      if (parsedCycle !== "unknown") {
        billingCycle = parsedCycle;
      }
    }
    billingCycle = billingCycle === "one_time" ? "unknown" : billingCycle;

    // Determine amount (enhance with PDF parsing if needed)
    let finalAmount = normalizedAmount;
    if (finalAmount === 0 && pdfText) {
      const parsedAmount = extractAmountAndCurrency(pdfText);
      if (parsedAmount && parsedAmount.amount > 0) {
        finalAmount = parsedAmount.amount;
        if (!extracted.currency || extracted.currency === "USD") {
          extracted.currency = parsedAmount.currency;
        }
      }
    }

    // Determine status
    const failedKeywords =
      /(payment failed|failed|declined|couldn't be processed|unable to process|unsuccessful)/i;
    const fullText = `${subject} ${snippet} ${bodyText} ${pdfText}`;
    const isFailed = failedKeywords.test(fullText);
    let subscriptionStatus = extracted.status || "active";
    if (isFailed) {
      subscriptionStatus = "payment_failed";
    } else if (finalAmount === 0) {
      if (extracted.status === "trial" || /trial|free/i.test(fullText)) {
        subscriptionStatus = "trial";
      } else if (extracted.status === "paused") {
        subscriptionStatus = "paused";
      }
    }

    // Determine if this is a subscription (not one-time)
    const isSubscription =
      extracted.kind === "subscription" ||
      subscriptionStatus === "trial" ||
      subscriptionStatus === "paused" ||
      subscriptionStatus === "payment_failed" ||
      subscriptionStatus === "cancel_soon" ||
      billingCycle !== "unknown" ||
      /subscription|recurring|renewal|membership|plan/i.test(fullText);

    if (!isSubscription) {
      processedMessages += 1;
      await updateScanProgress();
      return;
    }

    // Determine if this is a paid charge
    const isPaidCharge = finalAmount > 0 && !isFailed;

    // Compute dates
    const chargeDate = extracted.chargeDate
      ? new Date(extracted.chargeDate)
      : message.data.internalDate
      ? new Date(Number(message.data.internalDate))
      : new Date();

    const computeMonthlyAmount = (cycle, amount) => {
      if (!amount || Number.isNaN(amount)) return 0;
      switch (cycle) {
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

    const monthlyAmount = computeMonthlyAmount(billingCycle, finalAmount);
    const nextRenewal = new Date(chargeDate);
    if (billingCycle === "yearly") {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
    } else if (billingCycle === "monthly" || billingCycle === "weekly") {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    }

    // Find or create subscription
    let subscription = await SubscriptionModel.findOne({
      userId,
      serviceNormalized: normalizedService,
    });

    if (!subscription) {
      // Create new subscription
      try {
        subscription = await SubscriptionModel.create({
          userId,
          service: serviceText, // Store canonical name for display
          serviceNormalized: normalizedService, // Store normalized for key
          category: normalizedCategory,
          amount: finalAmount,
          monthlyAmount,
          estimatedMonthlySpend: monthlyAmount,
          totalAmount: isPaidCharge ? finalAmount : 0,
          totalCharges: isPaidCharge ? 1 : 0,
          currency: extracted.currency || "USD",
          billingCycle,
          nextRenewal,
          lastChargeAt: isPaidCharge ? chargeDate : undefined,
          status: subscriptionStatus,
          firstDetectedAt: new Date(),
        });
        newSubs.push(normalizedService);
        subsUpsertedCount += 1;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[gmail] Failed to create subscription", {
          error: err.message,
          service: serviceText,
        });
        processedMessages += 1;
        await updateScanProgress();
        return;
      }
    } else {
      // Update existing subscription
      subscription.amount = finalAmount || subscription.amount || 0;
      subscription.monthlyAmount =
        monthlyAmount || subscription.monthlyAmount || 0;
      subscription.estimatedMonthlySpend =
        monthlyAmount || subscription.estimatedMonthlySpend || 0;
      if (isPaidCharge) {
        subscription.totalAmount =
          (subscription.totalAmount || 0) + finalAmount;
        subscription.totalCharges = (subscription.totalCharges || 0) + 1;
        subscription.lastChargeAt = chargeDate;
      }
      subscription.category = normalizedCategory;
      subscription.currency =
        extracted.currency || subscription.currency || "USD";
      subscription.billingCycle = billingCycle;
      subscription.status = subscriptionStatus;
      subscription.nextRenewal = nextRenewal;
      try {
        await subscription.save();
        updatedSubs.push(normalizedService);
        subsUpsertedCount += 1;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[gmail] Failed to update subscription", {
          error: err.message,
          service: serviceText,
        });
      }
    }

    // Create Transaction and Charge only for paid charges
    if (isPaidCharge && msg.id) {
      // Transaction
      const existsTx = await TransactionModel.findOne({
        userId,
        gmailMessageId: msg.id,
      });
      if (!existsTx) {
        await TransactionModel.create({
          userId,
          subscriptionId: subscription.id,
          service: normalizedService,
          amount: finalAmount,
          currency: extracted.currency || "USD",
          billingCycle,
          chargedAt: chargeDate,
          gmailMessageId: msg.id,
          gmailThreadId: message.data.threadId || "",
          description: subject || serviceText || "Receipt",
        });
      }

      // Charge
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
          subject: subject || serviceText || "Receipt",
          from: from || "",
          status: "paid",
        });
        createdCharges += 1;
        chargesCreatedCount += 1;
      }
    }

    // Create review item if needed (based on confidence level and mode)
    // Use AI confidence if available, otherwise use presence confidence
    const aiConfidence = extracted.confidence || presenceResult.confidence;
    const confidenceLevel =
      aiConfidence >= 0.8
        ? 5
        : aiConfidence >= 0.6
        ? 4
        : aiConfidence >= 0.4
        ? 3
        : 2;
    const shouldCreateReviewItem =
      mode === "fast"
        ? confidenceLevel >= 4
        : mode === "strict"
        ? confidenceLevel >= 3
        : confidenceLevel >= 1;

    if (shouldCreateReviewItem) {
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
            confidence: aiConfidence,
            confidenceLevel,
            decision: "pending",
            cleanedPreview: `${bodyText} ${pdfText}`.substring(0, 500),
            aiExtracted: extracted,
            needsReview: confidenceLevel >= 4,
            lastSeenAt: new Date(),
            status: "pending",
          },
          { upsert: true, new: true }
        );
        foundCandidates += 1;
        pendingReview += 1;
      } catch (err) {
        if (err.code !== 11000) {
          // eslint-disable-next-line no-console
          console.error("[gmail] Failed to create review item", err.message);
        }
      }
    }

    previews.push({
      id: msg.id || "",
      from: from || "",
      subject: subject || serviceText || "Receipt",
      amount: finalAmount,
      currency: extracted.currency || "USD",
      billingCycle,
      chargedAt: chargeDate,
      status: subscriptionStatus,
      needsReview: shouldCreateReviewItem,
    });

    results.push({ gmailMessageId: msg.id || "" });
    processedMessages += 1;
    await updateScanProgress();
  };

  // Add periodic progress logging
  const progressInterval = setInterval(() => {
    // eslint-disable-next-line no-console
    console.log("[gmail] scan progress", {
      processed: processedMessages,
      total: totalMessages,
      pdfParsed: pdfParsedCount,
      presenceTrue: presenceTrueCount,
      aiCalled: aiCalledCount,
      subsUpserted: subsUpsertedCount,
      chargesCreated: chargesCreatedCount,
      foundCandidates,
      pendingReview,
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
  console.log("[gmail] scan complete V2", {
    userId,
    scanId,
    mode,
    totalMessages,
    processedMessages,
    skippedIdempotent,
    skippedNoPresence,
    pdfParsedCount,
    presenceTrueCount,
    aiCalledCount,
    subsUpsertedCount,
    chargesCreatedCount,
    createdSubscriptions: newSubs.length + updatedSubs.length,
    newSubscriptions: newSubs.length,
    updatedSubscriptions: updatedSubs.length,
    createdCharges,
    foundCandidates,
    pendingReview,
    verified,
    declined,
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
      processedMessages,
      skippedIdempotent,
      skippedNoPresence,
      pdfParsedCount,
      presenceTrueCount,
      aiCalledCount,
      subsUpsertedCount,
      chargesCreatedCount,
      createdSubscriptions: newSubs.length + updatedSubs.length,
      newSubscriptions: newSubs.length,
      updatedSubscriptions: updatedSubs.length,
      createdCharges,
      foundCandidates,
      pendingReview,
      newSubs: newSubs.slice(0, 10), // First 10 new subscriptions
      updatedSubs: updatedSubs.slice(0, 10), // First 10 updated subscriptions
    });
  }

  return { results, previews: previews.slice(-20), stats };
}
