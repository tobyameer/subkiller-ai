import { Response, NextFunction } from "express";
import { AuthedRequest } from "../middleware/auth";
import {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  restoreSubscriptionById,
} from "../services/subscriptionService";
import { computeNextRenewal, computeMonthlyAmount, type BillingCycle } from "../utils/billingDates";

export async function getSubscriptions(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const items = await listSubscriptions(req.user!.id, includeDeleted);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function postSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const payload = req.body;
    const billingCandidate =
      typeof payload.billingCycle === "string"
        ? ((payload.billingCycle.toLowerCase() as BillingCycle) || "unknown")
        : "unknown";
    const billingCycle: BillingCycle = ["monthly", "yearly", "weekly", "one_time", "unknown"].includes(billingCandidate)
      ? billingCandidate
      : "unknown";
    const chargedAt = payload.chargedAt ? new Date(payload.chargedAt) : new Date();
    const nextRenewal = computeNextRenewal(chargedAt, billingCycle);
    const monthlyAmount = computeMonthlyAmount(billingCycle, payload.amount || payload.monthlyAmount || 0);
    const fmt = (d: Date | null) => (d ? d.toISOString().split("T")[0] : "null");
    // eslint-disable-next-line no-console
    console.log(
      `[billing] computed dates service=${payload.service || "unknown"} chargedAt=${fmt(chargedAt)} nextRenewal=${fmt(nextRenewal)} billingCycle=${billingCycle}`,
    );
    const created = await createSubscription(req.user!.id, {
      ...payload,
      billingCycle,
      monthlyAmount,
      estimatedMonthlySpend:
        billingCycle === "monthly" ? monthlyAmount : billingCycle === "yearly" ? monthlyAmount / 12 : monthlyAmount,
      firstChargeAt: chargedAt,
      lastChargeAt: chargedAt,
      nextRenewal,
      totalCharges: 1,
      totalAmount: monthlyAmount,
      createdAt: new Date(),
    });
    // eslint-disable-next-line no-console
    console.log(
      `[billing] new subscription service=${created.service} monthlyAmount=${created.monthlyAmount} billingCycle=${created.billingCycle} lastChargeAt=${fmt(created.lastChargeAt)} nextRenewal=${fmt(created.nextRenewal)}`,
    );
    res.status(201).json({ subscription: created });
  } catch (err) {
    next(err);
  }
}

export async function putSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const payload = req.body || {};
    let updatePayload = { ...payload };
    if (payload.chargedAt || payload.billingCycle) {
      const billingCandidate =
        typeof payload.billingCycle === "string"
          ? ((payload.billingCycle.toLowerCase() as BillingCycle) || "unknown")
          : "unknown";
      const billingCycle: BillingCycle = ["monthly", "yearly", "weekly", "one_time", "unknown"].includes(
        billingCandidate,
      )
        ? billingCandidate
        : "unknown";
      const chargedAt = payload.chargedAt ? new Date(payload.chargedAt) : new Date();
      const monthlyAmount = computeMonthlyAmount(billingCycle, payload.amount || payload.monthlyAmount || 0);
      updatePayload = {
        ...payload,
        billingCycle,
        lastChargeAt: chargedAt,
        firstChargeAt: payload.firstChargeAt ? new Date(payload.firstChargeAt) : undefined,
        monthlyAmount,
        estimatedMonthlySpend:
          billingCycle === "monthly" ? monthlyAmount : billingCycle === "yearly" ? monthlyAmount / 12 : monthlyAmount,
        nextRenewal: computeNextRenewal(chargedAt, billingCycle),
      };
    }
    const updated = await updateSubscription(req.params.id, req.user!.id, updatePayload);
    res.json({ subscription: updated });
  } catch (err) {
    next(err);
  }
}

export async function removeSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await deleteSubscription(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function restoreSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const restored = await restoreSubscriptionById(req.params.id, req.user!.id);
    res.json({ subscription: restored });
  } catch (err) {
    next(err);
  }
}
