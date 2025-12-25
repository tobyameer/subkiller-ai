


import { extractSubscription } from "../services/aiService.js";
import { createSubscription } from "../services/subscriptionService.js";
import { scanGmailAndStore, clearUserGmailTokens } from "../services/gmailService.js";
import { UserModel } from "../models/User.js";

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
        const user = await UserModel.findById(req.user.id);
        const isPro = (user?.plan || "free") === "pro";
        if (!isPro) {
            const now = new Date();
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const usage = user?.scanUsage || {};
            const sameWindow = usage.windowStart && new Date(usage.windowStart) >= dayStart;
            const count = sameWindow ? usage.count || 0 : 0;
            const limit = 1;
            if (count >= limit) {
                return res.status(403).json({ code: "PLAN_LIMIT", message: "Scan limit reached. Upgrade to Pro for unlimited scans." });
            }
            await UserModel.findByIdAndUpdate(req.user.id, {
                scanUsage: { windowStart: dayStart, count: count + 1 },
            });
        }
        // eslint-disable-next-line no-console
        console.log("[scan] starting Gmail scan for user", req.user.id);
        const { results, previews, stats } = await scanGmailAndStore(req.user.id);
        res.json({
            ok: true,
            processed: (stats === null || stats === void 0 ? void 0 : stats.processedMessages) ?? results.length,
            createdSubscriptions: (stats === null || stats === void 0 ? void 0 : stats.createdSubscriptions) ?? 0,
            createdCharges: (stats === null || stats === void 0 ? void 0 : stats.createdCharges) ?? 0,
            previews: previews || [],
            stats: stats || {
                totalMessages: (previews === null || previews === void 0 ? void 0 : previews.length) || 0,
                processedMessages: (previews === null || previews === void 0 ? void 0 : previews.length) || 0,
                createdSubscriptions: 0,
                createdCharges: 0,
                durationMs: 0,
                avgMsPerMessage: 0,
            },
        });
        // eslint-disable-next-line no-console
        console.log("[gmail] scan complete", {
            userId: req.user.id,
            totalMessages: stats === null || stats === void 0 ? void 0 : stats.totalMessages,
            processed: stats === null || stats === void 0 ? void 0 : stats.processedMessages,
            created: results.length,
            durationMs: stats === null || stats === void 0 ? void 0 : stats.durationMs,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[scan] error", err?.message || err);
        const status = err?.status || 500;
        if (err?.code === "GMAIL_PERMISSION" || err?.code === "GMAIL_OAUTH") {
            await clearUserGmailTokens(req.user.id);
        }
        res.status(status).json({
            message: err?.message || "Scan failed",
            code: err?.code,
        });
    }
}
