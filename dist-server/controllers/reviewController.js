import { Types } from "mongoose";
import { UserModel } from "../models/User.js";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion.js";
import { ScanSessionModel } from "../models/ScanSession.js";
import { MerchantRuleModel } from "../models/MerchantRule.js";
import { IgnoredSenderModel } from "../models/IgnoredSender.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { TransactionModel } from "../models/Transaction.js";
import { ChargeModel } from "../models/Charge.js";
import { scanGmailAndStore } from "../services/gmailService.js";
import { normalizeAmount, normalizeTextField } from "../utils/normalize.js";
import { v4 as uuidv4 } from "uuid";

// Start a new Gmail scan (async)
export async function startScan(req, res, next) {
  try {
    const userId = req.user.id;
    let { mode = "fast", debug } = req.body; // mode: fast/strict/show_all, or "quick"/"deep" (user-friendly)

    // Map user-friendly modes to internal modes
    if (mode === "quick") mode = "fast";
    if (mode === "deep") mode = "strict";

    // Debug mode override
    if (debug === true) mode = "debug";

    // Check scan limits for free users
    const user = await UserModel.findById(userId);
    const isPro = (user?.plan || "free") === "pro";
    if (!isPro) {
      const now = new Date();
      const dayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const usage = user?.scanUsage || {};
      const sameWindow =
        usage.windowStart && new Date(usage.windowStart) >= dayStart;
      const count = sameWindow ? usage.count || 0 : 0;
      const limit = 1;
      if (count >= limit) {
        return res.status(403).json({
          code: "PLAN_LIMIT",
          message: "Scan limit reached. Upgrade to Pro for unlimited scans.",
        });
      }
      await UserModel.findByIdAndUpdate(userId, {
        scanUsage: { windowStart: dayStart, count: count + 1 },
      });
    }

    // Generate unique scanId
    const scanId = uuidv4();

    // Create scan session
    await ScanSessionModel.create({
      userId,
      scanId,
      status: "running",
      progress: {
        totalMessages: 0,
        processedMessages: 0,
        foundCandidates: 0,
        pendingReview: 0,
        verified: 0,
        declined: 0,
      },
      startedAt: new Date(),
    });

    // Start scan asynchronously (don't await)
    scanGmailAndStore(userId, scanId, mode).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[scan] async scan error", err);
      ScanSessionModel.findOneAndUpdate(
        { scanId },
        {
          status: "failed",
          completedAt: new Date(),
          error: err.message || "Scan failed",
        }
      ).catch(() => {
        // Ignore update errors
      });
    });

    res.json({
      ok: true,
      scanId,
      status: "running",
    });
  } catch (err) {
    next(err);
  }
}

// Get scan status
export async function getScanStatus(req, res, next) {
  try {
    const { scanId } = req.query;
    if (!scanId) {
      return res.status(400).json({ message: "scanId required" });
    }

    const session = await ScanSessionModel.findOne({
      scanId,
      userId: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ message: "Scan session not found" });
    }

    res.json({
      scanId: session.scanId,
      status: session.status,
      progress: session.progress,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      error: session.error,
    });
  } catch (err) {
    next(err);
  }
}

// Get next pending review item (prioritize level 5→4→3)
export async function getNextReviewItem(req, res, next) {
  try {
    const userId = req.user.id;

    // Find next pending item, sorted by confidenceLevel desc (5 first, then 4, then 3)
    const item = await PendingSubscriptionSuggestionModel.findOne({
      user: userId,
      decision: "pending",
    })
      .sort({ confidenceLevel: -1, createdAt: -1 })
      .lean();

    if (!item) {
      return res.json({ item: null });
    }

    res.json({ item });
  } catch (err) {
    next(err);
  }
}

// Verify a review item (create/update subscription)
export async function verifyReviewItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      service,
      amount,
      billingCycle,
      category,
      status: editedStatus,
      alwaysIgnoreSender,
    } = req.body;

    const reviewItem = await PendingSubscriptionSuggestionModel.findOne({
      _id: id,
      user: userId,
      decision: "pending",
    });

    if (!reviewItem) {
      return res.status(404).json({ message: "Review item not found" });
    }

    // Use edited fields if provided, otherwise use AI extraction
    const aiExtracted = reviewItem.aiExtracted || {};
    const finalService = service || aiExtracted.service || reviewItem.service;
    const finalAmount =
      amount !== undefined
        ? normalizeAmount(amount)
        : normalizeAmount(aiExtracted.amount) || reviewItem.amount || 0;
    const finalBillingCycle =
      billingCycle || aiExtracted.billingCycle || "monthly";
    const finalCategory =
      category || aiExtracted.category || reviewItem.category || "Other";
    const finalStatus = editedStatus || aiExtracted.status || "active";

    const serviceText = normalizeTextField(finalService);
    const normalizedService = serviceText
      ? serviceText.trim().toLowerCase()
      : null;

    if (!normalizedService) {
      return res.status(400).json({ message: "Service is required" });
    }

    // Update review item
    const editedFields = {};
    if (service) editedFields.service = service;
    if (amount !== undefined) editedFields.amount = amount;
    if (billingCycle) editedFields.billingCycle = billingCycle;
    if (category) editedFields.category = category;
    if (editedStatus) editedFields.status = editedStatus;

    reviewItem.decision = "verified";
    reviewItem.decisionMeta = {
      decidedAt: new Date(),
      editedFields:
        Object.keys(editedFields).length > 0 ? editedFields : undefined,
      alwaysIgnoreSender: alwaysIgnoreSender || false,
    };
    reviewItem.status = "accepted";
    await reviewItem.save();

    // Handle ignore sender
    if (alwaysIgnoreSender && reviewItem.from) {
      await IgnoredSenderModel.findOneAndUpdate(
        { user: userId, sender: reviewItem.from },
        { user: userId, sender: reviewItem.from },
        { upsert: true, new: true }
      );
    }

    // Update merchant rule
    if (reviewItem.from) {
      const domainMatch = reviewItem.from.match(/@([a-z0-9.-]+)\./i);
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        await MerchantRuleModel.findOneAndUpdate(
          { userId, domain },
          {
            $inc: { verifiedCount: 1 },
            $set: {
              defaultService: finalService,
              defaultCategory: finalCategory,
              defaultKind: aiExtracted.kind || "subscription",
              lastUpdated: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    // Create or update subscription
    let subscription = await SubscriptionModel.findOne({
      userId,
      serviceNormalized: normalizedService,
    });

    // Fallback: try legacy match
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
        legacyMatch.serviceNormalized = normalizedService;
        await legacyMatch.save();
        subscription = legacyMatch;
      }
    }

    const chargeDate = reviewItem.date || new Date();
    const computeMonthlyAmount = (cycle, amt) => {
      if (!amt || Number.isNaN(amt)) return 0;
      switch (cycle) {
        case "yearly":
          return amt / 12;
        case "weekly":
          return amt * 4.345;
        case "monthly":
          return amt;
        default:
          return 0;
      }
    };

    const monthlyAmount = computeMonthlyAmount(finalBillingCycle, finalAmount);
    const nextRenewal = new Date(chargeDate);
    if (finalBillingCycle === "yearly") {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
    } else {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    }

    if (!subscription) {
      // Create new subscription
      subscription = await SubscriptionModel.create({
        userId,
        service: serviceText,
        serviceNormalized: normalizedService,
        category: finalCategory,
        amount: finalAmount || 0,
        monthlyAmount: monthlyAmount || 0,
        estimatedMonthlySpend: monthlyAmount || 0,
        totalAmount: finalAmount > 0 ? finalAmount : 0,
        totalCharges: finalAmount > 0 ? 1 : 0,
        currency: aiExtracted.currency || reviewItem.currency || "USD",
        billingCycle: finalBillingCycle,
        nextRenewal,
        lastChargeAt: finalAmount > 0 ? chargeDate : undefined,
        status: finalStatus,
        firstDetectedAt: new Date(),
      });
    } else {
      // Update existing subscription
      subscription.amount = finalAmount || subscription.amount || 0;
      subscription.monthlyAmount =
        monthlyAmount || subscription.monthlyAmount || 0;
      subscription.estimatedMonthlySpend =
        monthlyAmount || subscription.estimatedMonthlySpend || 0;
      if (finalAmount > 0) {
        subscription.totalAmount =
          (subscription.totalAmount || 0) + finalAmount;
        subscription.totalCharges = (subscription.totalCharges || 0) + 1;
        subscription.lastChargeAt = chargeDate;
      }
      subscription.category = finalCategory;
      subscription.currency =
        aiExtracted.currency || subscription.currency || "USD";
      subscription.billingCycle = finalBillingCycle;
      subscription.status = finalStatus;
      subscription.nextRenewal = nextRenewal;
      await subscription.save();
    }

    // Create transaction and charge if amount > 0
    if (finalAmount > 0 && reviewItem.gmailMessageId) {
      // Check if already exists
      const existsTx = await TransactionModel.findOne({
        userId,
        gmailMessageId: reviewItem.gmailMessageId,
      });
      if (!existsTx) {
        await TransactionModel.create({
          userId,
          subscriptionId: subscription.id,
          service: normalizedService,
          amount: finalAmount,
          currency: aiExtracted.currency || reviewItem.currency || "USD",
          billingCycle: finalBillingCycle,
          chargedAt: chargeDate,
          gmailMessageId: reviewItem.gmailMessageId,
          gmailThreadId: reviewItem.gmailThreadId || "",
          description: reviewItem.subject || normalizedService || "Receipt",
        });
      }

      const existsCharge = await ChargeModel.findOne({
        userId,
        gmailMessageId: reviewItem.gmailMessageId,
        subscriptionId: subscription.id,
      });
      if (!existsCharge) {
        await ChargeModel.create({
          userId,
          subscriptionId: subscription.id,
          service: normalizedService,
          amount: finalAmount,
          currency: aiExtracted.currency || reviewItem.currency || "USD",
          billingCycle: finalBillingCycle,
          chargedAt: chargeDate,
          gmailMessageId: reviewItem.gmailMessageId || "",
          gmailThreadId: reviewItem.gmailThreadId || "",
          subject: reviewItem.subject || normalizedService || "Receipt",
          from: reviewItem.from || "",
          status: "paid",
        });
      }
    }

    // Update scan session progress
    await ScanSessionModel.updateMany(
      { userId, status: "running" },
      { $inc: { "progress.verified": 1, "progress.pendingReview": -1 } }
    );

    res.json({
      ok: true,
      subscription: {
        id: subscription.id,
        service: subscription.service,
        amount: subscription.amount,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Decline a review item
export async function declineReviewItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { alwaysIgnoreSender } = req.body;

    const reviewItem = await PendingSubscriptionSuggestionModel.findOne({
      _id: id,
      user: userId,
      decision: "pending",
    });

    if (!reviewItem) {
      return res.status(404).json({ message: "Review item not found" });
    }

    // Update review item
    reviewItem.decision = "declined";
    reviewItem.decisionMeta = {
      decidedAt: new Date(),
      alwaysIgnoreSender: alwaysIgnoreSender || false,
    };
    reviewItem.status = "ignored";
    await reviewItem.save();

    // Handle ignore sender
    if (alwaysIgnoreSender && reviewItem.from) {
      await IgnoredSenderModel.findOneAndUpdate(
        { user: userId, sender: reviewItem.from },
        { user: userId, sender: reviewItem.from },
        { upsert: true, new: true }
      );
    }

    // Update merchant rule
    if (reviewItem.from) {
      const domainMatch = reviewItem.from.match(/@([a-z0-9.-]+)\./i);
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        await MerchantRuleModel.findOneAndUpdate(
          { userId, domain },
          {
            $inc: { declinedCount: 1 },
            $set: { lastUpdated: new Date() },
          },
          { upsert: true, new: true }
        );
      }
    }

    // Update scan session progress
    await ScanSessionModel.updateMany(
      { userId, status: "running" },
      { $inc: { "progress.declined": 1, "progress.pendingReview": -1 } }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// List review items
export async function listReviewItems(req, res, next) {
  try {
    const userId = req.user.id;
    const { decision = "pending", level } = req.query;

    const query = {
      user: userId,
      decision,
    };

    if (level) {
      query.confidenceLevel = parseInt(level, 10);
    }

    const items = await PendingSubscriptionSuggestionModel.find(query)
      .sort({ confidenceLevel: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ items });
  } catch (err) {
    next(err);
  }
}
