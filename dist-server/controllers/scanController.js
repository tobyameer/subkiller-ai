import { extractSubscription } from "../services/aiService";
import { createSubscription } from "../services/subscriptionService";
import { scanGmailAndStore } from "../services/gmailService";
export async function scanEmail(req, res, next) {
    try {
        const { text } = req.body;
        const extracted = await extractSubscription(text);
        if (!extracted)
            return res.status(200).json({ subscription: null });
        const created = await createSubscription(req.user.id, {
            ...extracted,
            currency: extracted.currency || "USD",
            billingCycle: extracted.billingCycle || "monthly",
            nextRenewal: extracted.nextRenewal ? new Date(extracted.nextRenewal) : new Date(),
            status: extracted.status || "active",
            createdAt: extracted.createdAt ? new Date(extracted.createdAt) : new Date(),
        });
        res.json({ subscription: created });
    }
    catch (err) {
        next(err);
    }
}
export async function scanGmail(req, res, next) {
    try {
        const results = await scanGmailAndStore(req.user.id);
        res.json({ processed: results.length, created: results.length });
    }
    catch (err) {
        next(err);
    }
}
