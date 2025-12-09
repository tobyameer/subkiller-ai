import { Types } from "mongoose";
import { SubscriptionModel, Subscription } from "../models/Subscription";
import { ChargeModel } from "../models/Charge";
import { computeNextRenewal, computeMonthlyAmount, type BillingCycle } from "../utils/billingDates";

export async function listSubscriptions(userId: string, includeDeleted = false) {
  const query: any = { userId };
  if (!includeDeleted) query.deletedAt = null;
  return SubscriptionModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function createSubscription(userId: string, payload: Omit<Subscription, "userId">) {
  return SubscriptionModel.create({ ...payload, userId: new Types.ObjectId(userId) });
}

export async function updateSubscription(id: string, userId: string, payload: Partial<Subscription>) {
  const updated = await SubscriptionModel.findOneAndUpdate({ _id: id, userId }, payload, { new: true });
  return updated;
}

export async function deleteSubscription(id: string, userId: string) {
  await ChargeModel.deleteMany({ subscription: id, user: userId });
  return SubscriptionModel.findOneAndUpdate({ _id: id, userId }, { deletedAt: new Date() }, { new: true });
}

export async function restoreSubscriptionById(id: string, userId: string) {
  return SubscriptionModel.findOneAndUpdate({ _id: id, userId }, { deletedAt: null }, { new: true });
}

export async function refreshSubscriptionsForUser(userId: string) {
  const charges = await ChargeModel.find({ user: userId }).lean();
  const groups = new Map<
    string,
    {
      service: string;
      currency: string;
      charges: typeof charges;
      category?: string;
    }
  >();

  for (const charge of charges) {
    const key = `${charge.service}|${charge.currency}`.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { service: charge.service, currency: charge.currency, charges: [], category: charge.category });
    }
    groups.get(key)!.charges.push(charge);
  }

  const seenKeys: string[] = [];
  const cutoffMs = Date.now() - 400 * 24 * 60 * 60 * 1000; // ~13 months to keep annual charges

  for (const [key, group] of groups.entries()) {
    const latest = group.charges.sort((a, b) => new Date(b.chargedAt).getTime() - new Date(a.chargedAt).getTime())[0];
    if (!latest) continue;
    if (new Date(latest.chargedAt).getTime() < cutoffMs) continue;
    const recurringCharge = group.charges.find(
      (c) => c.kind === "subscription" && c.billingCycle !== "one_time" && c.billingCycle !== "unknown",
    );
    const billingCycle: BillingCycle =
      recurringCharge?.billingCycle && recurringCharge.billingCycle !== "unknown"
        ? recurringCharge.billingCycle
        : latest.billingCycle === "monthly" || latest.billingCycle === "yearly" || latest.billingCycle === "weekly"
          ? latest.billingCycle
          : "one_time";

    if (billingCycle === "one_time" || billingCycle === "unknown") {
      continue;
    }

    const monthlyAmount = computeMonthlyAmount(billingCycle, latest.amount);
    const nextRenewal = computeNextRenewal(new Date(latest.chargedAt), billingCycle);
    const status: Subscription["status"] = "active";
    const totalCharges = group.charges.length;
    const totalAmount = group.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
    const firstChargeAt = group.charges.reduce(
      (min, c) => (min && min < c.chargedAt ? min : c.chargedAt),
      group.charges[0].chargedAt,
    );
    const lastChargeAt = latest.chargedAt;
    const estimatedMonthlySpend = billingCycle === "yearly" ? monthlyAmount : monthlyAmount;

    await SubscriptionModel.findOneAndUpdate(
      { userId: userId, service: latest.service, currency: latest.currency },
      {
        userId: new Types.ObjectId(userId),
        service: latest.service,
        category: latest.category || "Other",
        currency: latest.currency,
        billingCycle,
        status,
        monthlyAmount,
        estimatedMonthlySpend,
        firstChargeAt,
        lastChargeAt,
        nextRenewal,
        totalCharges,
        totalAmount,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    seenKeys.push(key);
  }

  const existing = await SubscriptionModel.find({ userId }).lean();
  const toRemove = existing.filter((sub) => !seenKeys.includes(`${sub.service}|${sub.currency}`.toLowerCase()));
  if (toRemove.length > 0) {
    const ids = toRemove.map((s) => s._id);
    await SubscriptionModel.deleteMany({ _id: { $in: ids } });
  }
}

export async function autoMarkInactiveSubscriptions(userId: string) {
  const now = new Date();

  const monthlyGraceDays = 70; // ~2 months
  const weeklyGraceDays = 21; // ~3 weeks
  const yearlyGraceDays = 540; // ~18 months

  const cutoffMonthly = new Date(now.getTime() - monthlyGraceDays * 24 * 60 * 60 * 1000);
  const cutoffWeekly = new Date(now.getTime() - weeklyGraceDays * 24 * 60 * 60 * 1000);
  const cutoffYearly = new Date(now.getTime() - yearlyGraceDays * 24 * 60 * 60 * 1000);

  const activeishStatuses = ["active", "trial", "past_due", "on_hold", "unknown"];

  await SubscriptionModel.updateMany(
    {
      userId,
      billingCycle: "monthly",
      totalCharges: { $gte: 2 },
      lastChargeAt: { $lt: cutoffMonthly },
      status: { $in: activeishStatuses },
      deletedAt: null,
    },
    {
      $set: {
        status: "canceled",
        autoCanceled: true,
      },
    },
  );

  await SubscriptionModel.updateMany(
    {
      userId,
      billingCycle: "weekly",
      totalCharges: { $gte: 2 },
      lastChargeAt: { $lt: cutoffWeekly },
      status: { $in: activeishStatuses },
      deletedAt: null,
    },
    {
      $set: {
        status: "canceled",
        autoCanceled: true,
      },
    },
  );

  await SubscriptionModel.updateMany(
    {
      userId,
      billingCycle: "yearly",
      totalCharges: { $gte: 2 },
      lastChargeAt: { $lt: cutoffYearly },
      status: { $in: activeishStatuses },
      deletedAt: null,
    },
    {
      $set: {
        status: "canceled",
        autoCanceled: true,
      },
    },
  );

  await SubscriptionModel.updateMany(
    {
      userId,
      billingCycle: "one_time",
      status: { $ne: "expired" },
      deletedAt: null,
    },
    {
      $set: { status: "expired" },
    },
  );
}
