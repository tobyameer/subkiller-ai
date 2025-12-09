import { Request, Response, NextFunction } from "express";
import { AuthedRequest } from "../middleware/auth";
import { extractSubscription } from "../services/aiService";
import { createSubscription } from "../services/subscriptionService";
import { scanGmailAndStore } from "../services/gmailService";
import { computeNextRenewal, computeMonthlyAmount, type BillingCycle } from "../utils/billingDates";

export async function scanEmail(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { text } = req.body;
    const extracted = await extractSubscription({ text });
    if (!extracted) return res.status(200).json({ subscription: null });
    const billingCandidate =
      typeof extracted.billingCycle === "string"
        ? ((extracted.billingCycle.toLowerCase() as BillingCycle) || "unknown")
        : "unknown";
    const billingCycle: BillingCycle = ["monthly", "yearly", "weekly", "one_time", "unknown"].includes(billingCandidate)
      ? billingCandidate
      : "unknown";
    const chargedAt = new Date();
    const nextRenewal = computeNextRenewal(chargedAt, billingCycle);
    const monthlyAmount = computeMonthlyAmount(billingCycle, extracted.amount ? Number(extracted.amount) : 0);
    const fmt = (d: Date | null) => (d ? d.toISOString().split("T")[0] : "null");
    // eslint-disable-next-line no-console
    console.log(
      `[billing] computed dates service=${extracted.service || "unknown"} chargedAt=${fmt(chargedAt)} nextRenewal=${fmt(nextRenewal)} billingCycle=${billingCycle}`,
    );
    const created = await createSubscription(req.user!.id, {
      ...extracted,
      currency: extracted.currency || "USD",
      billingCycle,
      monthlyAmount,
      lastChargeAt: chargedAt,
      nextRenewal,
      status: "active",
      createdAt: extracted.createdAt ? new Date(extracted.createdAt) : new Date(),
    } as any);
    // eslint-disable-next-line no-console
    console.log(
      `[billing] new subscription service=${created.service} monthlyAmount=${created.monthlyAmount} billingCycle=${created.billingCycle} lastChargeAt=${fmt(created.lastChargeAt)} nextRenewal=${fmt(created.nextRenewal)}`,
    );
    res.json({ subscription: created });
  } catch (err) {
    next(err);
  }
}

export async function scanGmail(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const mode = (req.body?.mode as "incremental" | "full") || "incremental";
    const results = await scanGmailAndStore(req.user!.id, mode);
    res.json({
      processed: results.processed,
      newCharges: results.newCharges,
      skippedExisting: results.skippedExisting,
      skippedOther: results.skippedOther,
      mode,
      scannedAfter: results.scannedWindowAfter,
    });
  } catch (err) {
    next(err);
  }
}
