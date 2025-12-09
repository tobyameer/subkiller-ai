import { openai } from "../config/openai";
function fallbackServiceFromMeta(subject, from) {
    const candidates = [subject, from].filter(Boolean).join(" ");
    if (!candidates)
        return undefined;
    const domainMatch = candidates.match(/@([a-z0-9.-]+)\./i);
    if (domainMatch) {
        const domain = domainMatch[1];
        const clean = domain
            .split(".")
            .filter((part) => part && part !== "com")
            .join(" ");
        if (clean)
            return clean.trim();
    }
    const match = candidates.match(/([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/);
    if (match) {
        return match[0].trim();
    }
    return undefined;
}
export async function extractSubscription(input) {
    const { text, subject, from, snippet } = input;
    try {
        const prompt = `You are an extraction assistant for subscriptions. Use sender (from), subject, and body to determine if this email is a real subscription/payment/receipt.

Return JSON with keys: service, category, amount, currency, billingCycle, nextRenewal, status, kind.

Rules:
- "kind" must classify the email as one of: subscription, marketing, newsletter, one_time_purchase, other. Only use "subscription" when there is strong evidence of an active/recurring charge, renewal, receipt, or payment (words like receipt, invoice, charged, billed, subscription, membership, renews). Promotions/offers/newsletters/discounts are marketing or other.
- "service" must be a human-readable merchant/brand (Netflix, Spotify, Apple iCloud, Adobe, YouTube Premium, Amazon, DoorDash, PlayStation, Microsoft). Use sender/subject strongly. If it's clearly a payment or subscription, do not leave service null—use the merchant name. Only null if unrelated to billing/financial activity.
- "category" must be one of: Streaming, Music, Gaming, Productivity, Cloud, Finance, Fitness, Retail, Food, Other. If unsure, use "Other".
- "status" must be one of: active, trial, cancel_soon, canceled. Default to active if unsure.
- "amount" numeric only (no symbols/words). If missing, set to 0.
- "billingCycle" monthly or yearly when known; else omit.
- currency ISO code; if missing use USD.
- Do not include any extra fields.

Context:
Sender: ${from ?? "N/A"}
Subject: ${subject ?? "N/A"}
Snippet: ${snippet ?? ""}
Body:
${text}`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "Extract subscription details in JSON only. Be conservative: only call something a subscription if billing/charge/renewal evidence is clear; otherwise prefer marketing/other.",
                },
                { role: "user", content: prompt },
            ],
        });
        const message = response.choices[0]?.message?.content;
        if (!message)
            return null;
        const data = JSON.parse(message);
        // Fallback: if service missing, attempt from metadata
        if (!data.service) {
            const fallback = fallbackServiceFromMeta(subject, from);
            if (fallback)
                data.service = fallback;
        }
        // Ensure status is valid
        const validStatuses = ["active", "trial", "cancel_soon", "canceled", "paused"];
        if (!data.status || !validStatuses.includes(data.status)) {
            data.status = "active";
        }
        // Ensure kind default
        if (!data.kind)
            data.kind = "other";
        // Log extraction for debugging
        // eslint-disable-next-line no-console
        console.log("[ai] extracted subscription", {
            subject,
            from,
            service: data.service,
            category: data.category,
            amount: data.amount,
            kind: data.kind,
        });
        return data;
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("extractSubscription error", err);
        return null;
    }
}
