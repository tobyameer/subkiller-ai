
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, listChargesForSubscription, restoreSubscription } from "../services/subscriptionService.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { PlaidTransactionModel } from "../models/PlaidTransaction.js";
import { plaidAvailable } from "../config/plaid.js";

const normalizeMerchant = (name) => {
    if (!name)
        return "";
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\b(inc|llc|ltd|co|corp|company|limited|plc)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function getSubscriptions(req, res, next) {
    try {
        const includeDeleted = req.query.includeDeleted === "true";
        const items = await listSubscriptions(req.user.id, includeDeleted);
        // eslint-disable-next-line no-console
        console.log(`[api] GET /api/subscriptions - userId: ${req.user.id}, items: ${items.length}`);
        res.json({ items });
    }
    catch (err) {
        next(err);
    }
}
export async function postSubscription(req, res, next) {
    try {
        const payload = req.body;
        const created = await createSubscription(req.user.id, {
            ...payload,
            nextRenewal: new Date(payload.nextRenewal),
            createdAt: new Date(),
        });
        res.status(201).json({ subscription: created });
    }
    catch (err) {
        next(err);
    }
}
export async function putSubscription(req, res, next) {
    try {
        const updated = await updateSubscription(req.params.id, req.user.id, req.body);
        res.json({ subscription: updated });
    }
    catch (err) {
        next(err);
    }
}
export async function removeSubscription(req, res, next) {
    try {
        await deleteSubscription(req.params.id, req.user.id);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
}

export async function restoreSubscriptionHandler(req, res, next) {
    try {
        const restored = await restoreSubscription(req.params.id, req.user.id);
        if (!restored)
            return res.status(404).json({ message: "Subscription not found" });
        res.json({ subscription: restored });
    }
    catch (err) {
        next(err);
    }
}

export async function getSubscriptionCardTransactions(req, res, next) {
    try {
        const { id } = req.params;
        const sub = await SubscriptionModel.findOne({ _id: id, userId: req.user.id });
        if (!sub)
            return res.status(404).json({ message: "Subscription not found" });
        if (!plaidAvailable) {
            return res.json({ items: [] });
        }
        const serviceKey = normalizeMerchant(sub.service);
        let items = await PlaidTransactionModel.find({
            userId: req.user.id,
            merchantNormalized: serviceKey,
        })
            .sort({ date: -1 })
            .limit(50)
            .lean();
        if (!items.length) {
            const regex = new RegExp(`^${escapeRegex(serviceKey)}`, "i");
            items = await PlaidTransactionModel.find({
                userId: req.user.id,
                merchantNormalized: { $regex: regex },
            })
                .sort({ date: -1 })
                .limit(50)
                .lean();
        }
        const mapped = (items || []).map((tx) => ({
            id: tx._id?.toString() || tx.transactionId,
            transactionId: tx.transactionId,
            merchantName: tx.merchantName,
            merchantNormalized: tx.merchantNormalized,
            amount: tx.amount,
            currency: tx.currency || "USD",
            date: tx.date,
            pending: tx.pending,
            accountId: tx.accountId,
        }));
        res.json({ items: mapped });
    }
    catch (err) {
        next(err);
    }
}

export async function getSubscriptionDetails(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const subscription = await SubscriptionModel.findOne({ _id: id, userId });
        if (!subscription)
            return res.status(404).json({ message: "Subscription not found" });
        const charges = await listChargesForSubscription(userId, id);
        res.json({
            subscription,
            charges,
        });
    }
    catch (err) {
        next(err);
    }
}
