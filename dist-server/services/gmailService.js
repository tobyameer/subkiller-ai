import { google } from "googleapis";
import { Types } from "mongoose";
import { getGoogleClient } from "../config/google";
import { UserModel } from "../models/User";
import { extractSubscription } from "./aiService";
import { normalizeAmount, normalizeTextField } from "../utils/normalize";
import { PendingSubscriptionSuggestionModel } from "../models/PendingSubscriptionSuggestion";
import { IgnoredSenderModel } from "../models/IgnoredSender";
export async function exchangeCodeForTokens(code, userId) {
    const client = getGoogleClient();
    const { tokens } = await client.getToken(code);
    await UserModel.findByIdAndUpdate(userId, {
        gmailTokens: {
            access: tokens.access_token,
            refresh: tokens.refresh_token,
            expiry: tokens.expiry_date,
        },
    });
    return tokens;
}
export async function getAuthorizedGmailClient(userId) {
    const user = await UserModel.findById(userId);
    if (!user || !user.gmailTokens)
        throw { status: 400, message: "Gmail not connected" };
    const client = getGoogleClient();
    client.setCredentials({
        access_token: user.gmailTokens.access,
        refresh_token: user.gmailTokens.refresh,
        expiry_date: user.gmailTokens.expiry,
    });
    return google.gmail({ version: "v1", auth: client });
}
export async function scanGmailAndStore(userId) {
    const gmail = await getAuthorizedGmailClient(userId);
    const messages = await gmail.users.messages.list({
        userId: "me",
        maxResults: 5,
        q: '(receipt OR invoice OR payment OR charged OR subscription OR membership OR plan OR billed) -(gift guide OR sale OR discount OR offer OR "% off" OR deal OR promo OR holiday)',
    });
    const results = [];
    for (const msg of messages.data.messages ?? []) {
        const message = await gmail.users.messages.get({ userId: "me", id: msg.id || "" });
        const headers = message.data.payload?.headers || [];
        const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? undefined;
        const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? undefined;
        if (from) {
            const ignored = await IgnoredSenderModel.findOne({ user: userId, sender: from });
            if (ignored) {
                // eslint-disable-next-line no-console
                console.log("[gmail] Skipping ignored sender", from);
                continue;
            }
        }
        const bodyPart = message.data.payload?.parts?.find((p) => p.mimeType === "text/plain");
        const text = bodyPart?.body?.data ? Buffer.from(bodyPart.body.data, "base64").toString() : "Subscription email";
        const extracted = await extractSubscription({
            text,
            subject,
            from,
            snippet: message.data.snippet || "",
        });
        if (extracted) {
            // Rule-based overrides for promo/marketing subjects
            const promoPattern = /(percent off|% off|off for life|discount|offer|sale|gift guide|deal|promo|holiday|special offer|save)/i;
            const chargePattern = /(receipt|invoice|charged|payment|billed|renewal|renews|subscription|membership|your plan|premium)/i;
            const subjectText = subject || "";
            // Known merchant recall boost
            const knownMerchants = [
                { domain: /spotify\.com/i, hints: /(receipt|payment|premium|subscription|plan|membership)/i, service: "Spotify" },
                { domain: /netflix\.com/i, hints: /(receipt|payment|subscription|membership|renewal)/i, service: "Netflix" },
                { domain: /hulu\.com/i, hints: /(receipt|payment|subscription|membership|renewal)/i, service: "Hulu" },
                { domain: /apple\.com/i, hints: /(receipt|subscription|payment|invoice|itunes|app store)/i, service: "Apple" },
                { domain: /patreon\.com/i, hints: /(receipt|payment|membership|patron)/i, service: "Patreon" },
                { domain: /discord\.com/i, hints: /(nitro|subscription|payment|receipt|invoice)/i, service: "Discord" },
            ];
            const fromMatches = (regex) => (from ? regex.test(from) : false);
            const subjectMatches = (regex) => (subject ? regex.test(subject) : false);
            const merchantHit = knownMerchants.find((m) => fromMatches(m.domain) && subjectMatches(m.hints));
            if (merchantHit && extracted.kind !== "subscription") {
                extracted.kind = "subscription";
                if (!extracted.service)
                    extracted.service = merchantHit.service;
            }
            // Promo override
            if (promoPattern.test(subjectText) && !chargePattern.test(subjectText)) {
                extracted.kind = "marketing";
                // eslint-disable-next-line no-console
                console.log(`[gmail] Forced non-subscription due to promo subject: subject=${subjectText}`);
            }
            // Amount zero and promo-looking subject should be non-subscription
            if ((extracted.kind === "subscription" || extracted.kind === "other") && Number(extracted.amount || 0) === 0) {
                if (promoPattern.test(subjectText) && !chargePattern.test(subjectText)) {
                    extracted.kind = "marketing";
                    // eslint-disable-next-line no-console
                    console.log(`[gmail] Forced non-subscription due to zero-amount promo: subject=${subjectText}`);
                }
            }
            if (extracted.kind && extracted.kind !== "subscription") {
                // eslint-disable-next-line no-console
                console.log(`[gmail] Skipping non-subscription email: subject=${subject || "N/A"} kind=${extracted.kind}`);
                continue;
            }
            const normalizedAmount = normalizeAmount(extracted.amount);
            const normalizedService = normalizeTextField(extracted.service);
            const normalizedCategory = normalizeTextField(extracted.category) || "Other";
            if (normalizedAmount === null) {
                // eslint-disable-next-line no-console
                console.warn("[gmail] Skipping subscription due to invalid amount", extracted.amount);
                continue;
            }
            if (!normalizedService) {
                // eslint-disable-next-line no-console
                console.warn("[gmail] Skipping subscription due to invalid service", extracted.service);
                continue;
            }
            const allowedStatuses = ["active", "trial", "cancel_soon", "canceled", "paused"];
            const status = allowedStatuses.includes(extracted.status || "")
                ? extracted.status
                : "active";
            await PendingSubscriptionSuggestionModel.create({
                user: new Types.ObjectId(userId),
                gmailMessageId: msg.id || "",
                subject: subject || "",
                from: from || "",
                service: normalizedService,
                amount: normalizedAmount ?? 0,
                currency: extracted.currency || "USD",
                category: normalizedCategory,
                kind: extracted.kind || "other",
                status: "pending",
            });
            results.push({ gmailMessageId: msg.id || "" });
        }
    }
    return results;
}
