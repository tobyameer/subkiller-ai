import { Types } from "mongoose";
import { SubscriptionModel } from "../models/Subscription.js";
import { TransactionModel } from "../models/Transaction.js";
import { ChargeModel } from "../models/Charge.js";

export async function listSubscriptions(userId, includeDeleted = false) {
  const filter = includeDeleted
    ? { userId }
    : { userId, deletedAt: { $exists: false } };
  const subs = await SubscriptionModel.find(filter)
    .sort({ lastChargeAt: -1 })
    .lean();

  // Filter out only truly invalid subscriptions (no service name)
  // Keep all subscriptions including $0 ones (trials, paused, payment_failed, etc.)
  const valid = subs.filter((s) => {
    // Only filter out if service name is missing
    return s.service && s.service.trim().length > 0;
  });

  // Verify totals against actual charges for accuracy, but don't exclude $0 subscriptions
  const verified = await Promise.all(
    valid.map(async (sub) => {
      // Verify totals if they seem incorrect (both are 0 but subscription exists)
      // This helps catch edge cases where totals weren't updated correctly
      if ((sub.totalCharges || 0) === 0 && (sub.totalAmount || 0) === 0) {
        const charges = await ChargeModel.find({
          userId,
          subscriptionId: sub._id,
          status: "paid",
        }).lean();

        const computedCharges = charges.length;
        const computedAmount = charges.reduce(
          (sum, c) => sum + Math.abs(Number(c.amount || 0)),
          0
        );

        // Use computed totals if available, but keep subscription even if 0
        return {
          ...sub,
          totalCharges:
            computedCharges > 0 ? computedCharges : sub.totalCharges || 0,
          totalAmount:
            computedAmount > 0 ? computedAmount : sub.totalAmount || 0,
        };
      }
      return sub;
    })
  );

  return verified;
}
export async function createSubscription(userId, payload) {
  return SubscriptionModel.create({
    ...payload,
    userId: new Types.ObjectId(userId),
  });
}
export async function updateSubscription(id, userId, payload) {
  const updated = await SubscriptionModel.findOneAndUpdate(
    { _id: id, userId },
    payload,
    { new: true }
  );
  return updated;
}
export async function deleteSubscription(id, userId) {
  return SubscriptionModel.findOneAndUpdate(
    { _id: id, userId },
    { deletedAt: new Date() },
    { new: true }
  );
}

export async function restoreSubscription(id, userId) {
  return SubscriptionModel.findOneAndUpdate(
    { _id: id, userId },
    { $unset: { deletedAt: 1 } },
    { new: true }
  );
}

export async function listTransactionsForSubscription(userId, subscriptionId) {
  return TransactionModel.find({ userId, subscriptionId })
    .sort({ chargedAt: -1 })
    .lean();
}

export async function listChargesForSubscription(userId, subscriptionId) {
  return ChargeModel.find({ userId, subscriptionId })
    .sort({ chargedAt: -1 })
    .lean();
}
