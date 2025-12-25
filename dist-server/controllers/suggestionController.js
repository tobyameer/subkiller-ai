
import { Types } from "mongoose";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { normalizeAmount, normalizeTextField } from "../utils/normalize.js";
import { IgnoredSenderModel } from "../models/IgnoredSender.js";
export async function listSuggestions(req, res, next) {
    try {
        const items = await PendingSubscriptionSuggestionModel.find({
            user: req.user.id,
            status: "pending",
        })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ items });
    }
    catch (err) {
        next(err);
    }
}
export async function acceptSuggestion(req, res, next) {
    try {
        const { id } = req.params;
        const suggestion = await PendingSubscriptionSuggestionModel.findOne({
            _id: id,
            user: req.user.id,
            status: "pending",
        });
        if (!suggestion)
            return res.status(404).json({ message: "Suggestion not found" });
        const service = normalizeTextField(suggestion.service);
        const amount = normalizeAmount(suggestion.amount);
        if (!service)
            return res.status(400).json({ message: "Service is required to create subscription" });
        const subscription = await SubscriptionModel.create({
            userId: new Types.ObjectId(req.user.id),
            service,
            category: suggestion.category || "Other",
            amount: amount ?? 0,
            currency: suggestion.currency || "USD",
            billingCycle: "monthly",
            nextRenewal: new Date(),
            status: "active",
        });
        suggestion.status = "accepted";
        await suggestion.save();
        res.json({ subscription });
    }
    catch (err) {
        next(err);
    }
}
export async function ignoreSuggestion(req, res, next) {
    try {
        const { id } = req.params;
        const suggestion = await PendingSubscriptionSuggestionModel.findOne({
            _id: id,
            user: req.user.id,
            status: "pending",
        });
        if (!suggestion)
            return res.status(404).json({ message: "Suggestion not found" });
        suggestion.status = "ignored";
        await suggestion.save();
        // auto-add ignored sender
        if (suggestion.from) {
            await IgnoredSenderModel.findOneAndUpdate({ user: req.user.id, sender: suggestion.from }, { user: req.user.id, sender: suggestion.from }, { upsert: true });
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
}
export async function suggestionSummary(req, res, next) {
    try {
        const userId = req.user.id;
        const agg = await PendingSubscriptionSuggestionModel.aggregate([
            { $match: { user: new Types.ObjectId(userId) } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const summary = agg.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, { pending: 0, accepted: 0, ignored: 0 });
        res.json({ summary });
    }
    catch (err) {
        next(err);
    }
}
