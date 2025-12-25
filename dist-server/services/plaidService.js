import { Types } from "mongoose";
import { PlaidTransactionModel } from "../models/PlaidTransaction.js";
import { SubscriptionModel } from "../models/Subscription.js";

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

const similarityScore = (a, b) => {
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    if (a.includes(b) || b.includes(a))
        return 0.9;
    const aTokens = new Set(a.split(" ").filter(Boolean));
    const bTokens = new Set(b.split(" ").filter(Boolean));
    const intersection = [...aTokens].filter((t) => bTokens.has(t)).length;
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    return intersection / union;
};

const amountMatches = (plaidAmount, subscriptionAmount) => {
    if (!plaidAmount || !subscriptionAmount)
        return false;
    const diff = Math.abs(plaidAmount - subscriptionAmount);
    const tolerance = Math.max(plaidAmount, subscriptionAmount) * 0.1;
    return diff <= tolerance;
};

const inferBillingCycleFromDates = (dates) => {
    if (dates.length < 2)
        return "unknown";
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const diffs = [];
    for (let i = 1; i < sorted.length; i += 1) {
        const days = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0)
            diffs.push(days);
    }
    if (!diffs.length)
        return "unknown";
    const avg = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    if (avg >= 5 && avg <= 10)
        return "weekly";
    if (avg >= 23 && avg <= 40)
        return "monthly";
    if (avg >= 330 && avg <= 400)
        return "yearly";
    return "unknown";
};

const computeMonthlyAmount = (cycle, amount) => {
    if (!amount || Number.isNaN(amount))
        return 0;
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

const isStableAmount = (transactions, tolerance = 0.15) => {
    if (!transactions.length)
        return false;
    const amounts = transactions.map((t) => Math.abs(Number(t.amount || 0))).filter((v) => v > 0);
    if (amounts.length < 2)
        return false;
    const avg = amounts.reduce((sum, v) => sum + v, 0) / amounts.length;
    return amounts.every((v) => Math.abs(v - avg) <= avg * tolerance);
};

const isLikelySubscriptionMerchant = (name) => {
    if (!name)
        return false;
    const bad = /payment|transfer|top\s?up|wallet|cash|atm|refund|reversal|chargeback|loan|card\s?payment|credit\s?card\s?payment|installment|p2p|venmo|cashapp|zelle/i;
    return !bad.test(name.toLowerCase());
};

const inferCycleStrict = (dates) => {
    if (!dates || dates.length < 2)
        return "unknown";
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const diffs = [];
    for (let i = 1; i < sorted.length; i += 1) {
        const days = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0)
            diffs.push(days);
    }
    if (!diffs.length)
        return "unknown";
    const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    if (avg >= 5 && avg <= 9)
        return "weekly";
    if (avg >= 20 && avg <= 40)
        return "monthly";
    if (avg >= 330 && avg <= 400)
        return "yearly";
    return "unknown";
};

const classifyMatch = ({ matchType, confidenceScore, action, reason }) => ({
    matchType,
    confidenceScore,
    action,
    reason,
});

const backfillMerchantNormalized = async (userId) => {
    const missing = await PlaidTransactionModel.find({
        userId: new Types.ObjectId(userId),
        $or: [{ merchantNormalized: { $exists: false } }, { merchantNormalized: "" }],
    })
        .limit(200)
        .lean();
    if (!missing.length)
        return 0;
    const ops = missing.map((doc) => ({
        updateOne: {
            filter: { _id: doc._id },
            update: { $set: { merchantNormalized: normalizeMerchant(doc.merchantName || "") } },
        },
    }));
    const res = await PlaidTransactionModel.bulkWrite(ops, { ordered: false });
    // eslint-disable-next-line no-console
    console.log("[plaid] backfill merchantNormalized", res.modifiedCount || 0);
    return res.modifiedCount || 0;
};

export async function storePlaidTransactions(userId, transactions = []) {
    const docs = [];
    for (const tx of transactions) {
        if (!tx || !tx.transaction_id || !tx.date)
            continue;
        docs.push({
            userId: new Types.ObjectId(userId),
            transactionId: tx.transaction_id,
            merchantName: tx.merchant_name || tx.name || "",
            merchantNormalized: normalizeMerchant(tx.merchant_name || tx.name || ""),
            amount: Math.abs(Number(tx.amount || 0)),
            currency: tx.iso_currency_code || "USD",
            date: new Date(tx.date),
            pending: Boolean(tx.pending),
            accountId: tx.account_id,
            recurring: Boolean(tx.recurring),
            recurringCycle: tx.recurring?.interval || "unknown",
        });
    }
    if (!docs.length)
        return 0;
    const ops = docs.map((doc) => ({
        updateOne: {
            filter: { userId: doc.userId, transactionId: doc.transactionId },
            update: { $setOnInsert: doc },
            upsert: true,
        },
    }));
    const result = await PlaidTransactionModel.bulkWrite(ops, { ordered: false });
    return result.upsertedCount || 0;
}

export async function syncPlaidAndMerge(userId, transactions = []) {
    await backfillMerchantNormalized(userId);
    const inserted = await storePlaidTransactions(userId, transactions);
    const mergeResult = await mergePlaidWithSubscriptions(userId);
    return { inserted, ...mergeResult };
}

export async function mergePlaidWithSubscriptions(userId) {
    const plaidTransactions = await PlaidTransactionModel.find({
        userId,
        pending: false,
    }).lean();
    if (!plaidTransactions.length) {
        return { matched: 0, created: 0, updated: 0, ignored: 0 };
    }

    const subscriptions = await SubscriptionModel.find({ userId });
    const grouped = new Map();
    plaidTransactions.forEach((tx) => {
        const merchant = normalizeMerchant(tx.merchantName || "");
        if (!merchant)
            return;
        if (!isLikelySubscriptionMerchant(merchant))
            return;
        if (!grouped.has(merchant)) {
            grouped.set(merchant, { merchant, transactions: [] });
        }
        grouped.get(merchant).transactions.push(tx);
    });

    const matchedSubIds = new Set();
    let created = 0;
    let updated = 0;
    let matched = 0;
    let ignored = 0;

    for (const group of grouped.values()) {
        const txs = group.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const normalizedService = group.merchant;
        const oneOff = /starbucks|mcdonald|burger|pizza|uber|lyft|doordash|instacart|airlines|delta|united|ryanair|wizz|booking|expedia|hotel|shell|chevron/i;
        if (oneOff.test(normalizedService)) {
            // eslint-disable-next-line no-console
            console.warn("REJECT_CARD_SUB:", normalizedService, "reason=one_off_pattern");
            ignored += 1;
            continue;
        }

        // Bucket by currency + ~10% amount tolerance to avoid mixing one-off purchases
        const buckets = [];
        const tolerancePct = 0.1;
        const addToBucket = (tx) => {
            for (const bucket of buckets) {
                if (bucket.currency !== (tx.currency || "USD"))
                    continue;
                const ref = bucket.refAmount;
                const amt = Math.abs(Number(tx.amount || 0));
                const tol = Math.max(ref, amt) * tolerancePct;
                if (Math.abs(ref - amt) <= tol) {
                    bucket.txs.push(tx);
                    bucket.refAmount = (bucket.refAmount * (bucket.txs.length - 1) + amt) / bucket.txs.length;
                    return;
                }
            }
            buckets.push({
                currency: tx.currency || "USD",
                refAmount: Math.abs(Number(tx.amount || 0)),
                txs: [tx],
            });
        };
        txs.forEach(addToBucket);

        const candidateBuckets = buckets
            .map((bucket) => {
            const bucketTxs = bucket.txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const dates = bucketTxs.map((t) => new Date(t.date));
            const inferredCycle = inferCycleStrict(dates);
            const stableAmounts = isStableAmount(bucketTxs);
            const meetsCount = bucketTxs.length >= 2;
            if (!meetsCount) return null;
            if (!["weekly", "monthly", "yearly"].includes(inferredCycle)) return null;
            return {
                txs: bucketTxs,
                inferredCycle,
                stableAmounts,
                meetsCount,
            };
        })
            .filter((b) => b && b.meetsCount && b.stableAmounts);

        if (!candidateBuckets.length) {
            // eslint-disable-next-line no-console
            console.warn("REJECT_CARD_SUB:", normalizedService, "reason=no_cadence_or_amount_stability");
            ignored += 1;
            continue;
        }

        // Use the bucket with the latest transaction
        candidateBuckets.sort((a, b) => new Date(b.txs[0].date).getTime() - new Date(a.txs[0].date).getTime());
        const bucket = candidateBuckets[0];
        const bucketTxs = bucket.txs;
        const latest = bucketTxs[0];
        const dates = bucketTxs.map((t) => new Date(t.date));
        const inferredCycle = bucket.inferredCycle;
        const plaidRecurring = bucket.plaidRecurring;
        const sortedDatesAsc = [...dates].sort((a, b) => a.getTime() - b.getTime());
        const spanDays = sortedDatesAsc.length >= 2
            ? Math.abs((sortedDatesAsc[sortedDatesAsc.length - 1].getTime() - sortedDatesAsc[0].getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const spansWindow =
            (inferredCycle === "weekly" && spanDays >= 5) ||
            (inferredCycle === "monthly" && spanDays >= 25 && spanDays <= 40) ||
            (inferredCycle === "yearly" && spanDays >= 330 && spanDays <= 400);

        let bestMatch = null;
        let bestScore = 0;
        for (const sub of subscriptions) {
            // Use serviceNormalized if available, otherwise fall back to normalizing service
            const subName = sub.serviceNormalized || normalizeMerchant(sub.service);
            const similarity = similarityScore(normalizedService, subName);
            if (similarity < 0.6)
                continue;
            const baseAmount = sub.confirmedAmount ?? sub.amount ?? sub.monthlyAmount ?? sub.estimatedMonthlySpend ?? 0;
            const plaidAmount = Math.abs(Number(latest.amount || 0));
            if (!amountMatches(plaidAmount, baseAmount))
                continue;
            const score = similarity + 0.1;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = sub;
            }
        }

        if (bestMatch) {
            matchedSubIds.add(bestMatch.id);
            const latestAmount = Math.abs(Number(latest.amount || 0));
            if (latestAmount) {
                bestMatch.confirmedAmount = latestAmount;
            }
            const currentConfidence = bestMatch.sourceConfidence || "email_only";
            const shouldFillCycle = inferredCycle !== "unknown" &&
                (!bestMatch.confirmedBillingCycle || bestMatch.confirmedBillingCycle === "unknown") &&
                (currentConfidence === "email+card" || currentConfidence === "card_only");
            if (shouldFillCycle) {
                bestMatch.confirmedBillingCycle = inferredCycle;
            }
            bestMatch.lastChargeAt = new Date(latest.date);
            bestMatch.lastPlaidTransactionAt = new Date(latest.date);
            const shouldApplyTotals = latest.transactionId &&
                latest.transactionId !== bestMatch.lastPlaidTransactionId;
            if (shouldApplyTotals) {
                bestMatch.totalAmount = (bestMatch.totalAmount || 0) + latestAmount;
                bestMatch.totalCharges = (bestMatch.totalCharges || 0) + 1;
                bestMatch.lastPlaidTransactionId = latest.transactionId;
            }
            bestMatch.plaidLinked = true;
            bestMatch.source = "email+card";
            bestMatch.sourceConfidence = "email+card";
            bestMatch.autoCanceled = false;
            bestMatch.autoCanceledReason = undefined;
            if (bestMatch.status === "canceled") {
                bestMatch.status = "active";
            }
            try {
                await bestMatch.save();
                updated += 1;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[plaid] Failed to save subscription update:", {
                    error: err.message,
                    errors: err.errors,
                    subscriptionId: bestMatch._id,
                    service: bestMatch.service,
                    userId,
                });
                throw err;
            }
            matched += 1;
            // eslint-disable-next-line no-console
            console.log("[plaid] merge", classifyMatch({
                matchType: "email+card",
                confidenceScore: Math.min(1, bestScore),
                action: "update",
                reason: "Matched merchant and amount within 10%",
            }));
            continue;
        }

        if (bucket && spansWindow) {
            const amount = Math.abs(Number(latest.amount || 0));
            const monthlyAmount = computeMonthlyAmount(inferredCycle, amount);
            const firstDetectedAt = dates.sort((a, b) => a.getTime() - b.getTime())[0];
            const nextRenewal = new Date(latest.date);
            if (inferredCycle === "yearly") {
                nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
            }
            else if (inferredCycle === "weekly") {
                nextRenewal.setDate(nextRenewal.getDate() + 7);
            }
            else {
                nextRenewal.setMonth(nextRenewal.getMonth() + 1);
            }
            // Use original merchant name for service, normalized for serviceNormalized
            const originalServiceName = latest.merchantName || group.merchant;
            try {
                await SubscriptionModel.create({
                    userId: new Types.ObjectId(userId),
                    service: originalServiceName, // Human-readable name
                    serviceNormalized: group.merchant, // Normalized for queries
                    category: "Other",
                    amount,
                    confirmedAmount: amount,
                    monthlyAmount,
                    estimatedMonthlySpend: monthlyAmount,
                    totalAmount: bucketTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0),
                    totalCharges: bucketTxs.length,
                    currency: latest.currency || "USD",
                    billingCycle: inferredCycle,
                    confirmedBillingCycle: inferredCycle,
                    nextRenewal,
                    lastChargeAt: new Date(latest.date),
                    firstDetectedAt,
                    status: "active",
                    plaidLinked: true,
                    source: "card",
                    sourceConfidence: "card_only",
                    lastPlaidTransactionId: latest.transactionId,
                    lastPlaidTransactionAt: new Date(latest.date),
                });
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[plaid] Failed to create subscription:", {
                    error: err.message,
                    errors: err.errors,
                    service: originalServiceName,
                    serviceNormalized: group.merchant,
                    userId,
                });
                throw err;
            }
            created += 1;
            // eslint-disable-next-line no-console
            console.log("[plaid] merge", classifyMatch({
                matchType: "card_only",
                confidenceScore: 0.8,
                action: "create",
                reason: `Recurring card charges detected (>=${bucketTxs.length} occurrences, stable amounts, cycle=${inferredCycle}, spanDays=${Math.round(spanDays)})`,
            }));
            continue;
        }

        ignored += 1;
        // eslint-disable-next-line no-console
        console.log("[plaid] merge", classifyMatch({
            matchType: "unmatched",
            confidenceScore: 0.3,
            action: "ignore",
            reason: "No Gmail match and insufficient recurrence",
        }));
    }

    // Mark email-only subscriptions that did not match Plaid
    for (const sub of subscriptions) {
        if (matchedSubIds.has(sub.id))
            continue;
        if (sub.plaidLinked || sub.sourceConfidence === "email+card" || sub.sourceConfidence === "card_only")
            continue;
        const isEmailDerived = sub.source === "email" || !sub.source;
        if (!isEmailDerived)
            continue;
        sub.sourceConfidence = "email_only";
        sub.source = "email";
        await sub.save();
    }

    // Auto-cancel if no recent card activity for > expected next charge + grace
    for (const sub of subscriptions) {
        if (!sub.plaidLinked)
            continue;
        const lastChargeAt = sub.lastChargeAt ? new Date(sub.lastChargeAt) : null;
        if (!lastChargeAt)
            continue;
        const cycle = sub.confirmedBillingCycle || sub.billingCycle;
        if (!["weekly", "monthly", "yearly"].includes(cycle))
            continue;
        const expectedNextCharge = new Date(lastChargeAt);
        if (cycle === "weekly") {
            expectedNextCharge.setDate(expectedNextCharge.getDate() + 7);
        }
        else if (cycle === "monthly") {
            expectedNextCharge.setMonth(expectedNextCharge.getMonth() + 1);
        }
        else {
            expectedNextCharge.setFullYear(expectedNextCharge.getFullYear() + 1);
        }
        const graceDays = cycle === "weekly" ? 14 : cycle === "monthly" ? 30 : 90;
        const graceMs = graceDays * 24 * 60 * 60 * 1000;
        if (Date.now() > expectedNextCharge.getTime() + graceMs) {
            sub.status = "canceled";
            sub.autoCanceled = true;
            sub.autoCanceledReason = "No recent card activity";
            await sub.save();
        }
    }

    return { matched, created, updated, ignored };
}
