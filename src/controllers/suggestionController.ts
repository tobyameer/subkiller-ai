import { Request, Response, NextFunction } from "express";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion";
import { SubscriptionModel } from "../models/Subscription";
import { AuthedRequest } from "../middleware/auth";
import { normalizeAmount, normalizeTextField } from "../utils/normalize";
import { IgnoredSenderModel } from "../models/IgnoredSender";
import { Types } from "mongoose";
import { computeNextRenewal, computeMonthlyAmount, type BillingCycle } from "../utils/billingDates";

export async function listSuggestions(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const items = await PendingSubscriptionSuggestionModel.find({
      user: req.user!.id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function acceptSuggestion(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const suggestion = await PendingSubscriptionSuggestionModel.findOne({
      _id: id,
      user: req.user!.id,
      status: "pending",
    });
    if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });
    const service = normalizeTextField(suggestion.service);
    const amount = normalizeAmount(suggestion.amount);
    if (!service) return res.status(400).json({ message: "Service is required to create subscription" });
    if (amount === null || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero" });
    }
    const billingCandidate =
      typeof suggestion.billingCycle === "string"
        ? ((suggestion.billingCycle.toLowerCase() as BillingCycle) || "unknown")
        : "unknown";
    const billingCycle: BillingCycle = ["monthly", "yearly", "weekly", "one_time", "unknown"].includes(billingCandidate)
      ? billingCandidate
      : "unknown";
    const chargedAt = suggestion.chargedAt ? new Date(suggestion.chargedAt) : new Date();
    const nextRenewal = computeNextRenewal(chargedAt, billingCycle);
    const monthlyAmount = computeMonthlyAmount(billingCycle, amount ?? 0);
    const fmt = (d: Date | null) => (d ? d.toISOString().split("T")[0] : "null");
    // eslint-disable-next-line no-console
    console.log(
      `[billing] computed dates service=${service} chargedAt=${fmt(chargedAt)} nextRenewal=${fmt(nextRenewal)} billingCycle=${billingCycle}`,
    );
    const subscription = await SubscriptionModel.create({
      userId: new Types.ObjectId(req.user!.id),
      service,
      category: suggestion.category || "Other",
      currency: suggestion.currency || "USD",
      billingCycle,
      monthlyAmount,
      lastChargeAt: chargedAt,
      nextRenewal,
      status: "active",
    } as any);
    // eslint-disable-next-line no-console
    console.log(
      `[billing] new subscription service=${service} monthlyAmount=${monthlyAmount} billingCycle=${billingCycle} chargedAt=${fmt(chargedAt)} nextRenewal=${fmt(nextRenewal)}`,
    );
    suggestion.status = "accepted";
    await suggestion.save();
    res.json({ subscription });
  } catch (err) {
    next(err);
  }
}

export async function ignoreSuggestion(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const suggestion = await PendingSubscriptionSuggestionModel.findOne({
      _id: id,
      user: req.user!.id,
      status: "pending",
    });
    if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });
    suggestion.status = "ignored";
    await suggestion.save();
    // auto-add ignored sender
    if (suggestion.from) {
      await IgnoredSenderModel.findOneAndUpdate(
        { user: req.user!.id, sender: suggestion.from },
        { user: req.user!.id, sender: suggestion.from },
        { upsert: true },
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function suggestionSummary(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const agg = await PendingSubscriptionSuggestionModel.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const summary = agg.reduce(
      (acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      { pending: 0, accepted: 0, ignored: 0 } as Record<string, number>,
    );
    res.json({ summary });
  } catch (err) {
    next(err);
  }
}
