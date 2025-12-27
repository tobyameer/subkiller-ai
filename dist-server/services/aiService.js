import { openai } from "../config/openai.js";
function fallbackServiceFromMeta(subject, from) {
  const candidates = [subject, from].filter(Boolean).join(" ");
  if (!candidates) return undefined;
  const domainMatch = candidates.match(/@([a-z0-9.-]+)\./i);
  if (domainMatch) {
    const domain = domainMatch[1];
    const clean = domain
      .split(".")
      .filter((part) => part && part !== "com")
      .join(" ");
    if (clean) return clean.trim();
  }
  const match = candidates.match(
    /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/
  );
  if (match) {
    return match[0].trim();
  }
  return undefined;
}
export async function extractSubscription(input) {
  const { text, subject, from, snippet } = input;
  try {
    const prompt = `You are an extraction assistant for a subscription tracking app.

Your job: extract structured data from an email about billing.

Return JSON ONLY with these keys (no extras):
- service (string | null) - Raw service name as mentioned in email
- service_canonical (string | null) - Canonical service name (e.g., "Tinder" not "Tinder Dating App: Date & Chat")
- provider (string | null) - Provider platform: "apple", "google", "stripe", "direct", or null
- product_name (string | null) - Optional product name if different from service (e.g., "iCloud+" vs "Apple")
- category (one of: Streaming, Music, Gaming, Productivity, Cloud, Finance, Fitness, Retail, Food, Other)
- amount (number)
- currency (ISO code like USD, EGP, EUR)
- billingCycle (one of: monthly, yearly, weekly, one_time, unknown)
- nextRenewal (ISO date string YYYY-MM-DD or null)
- status (one of: active, trial, cancel_soon, canceled, paused, payment_failed)
- kind (one of: subscription, one_time_purchase, marketing, newsletter, other)
- confidence (number 0-1) - Confidence in extraction accuracy

Important classification rules:
- Use kind="subscription" if the email indicates a subscription/membership account OR a renewal cycle OR an upcoming recurring charge, even if the current email total is 0.00.
  Examples that ARE subscriptions:
  - trial receipt / trial ending / "you will be charged $X every month" / "next billing" / "your plan" / "membership" / "auto-renew" / paused membership / payment failed for renewal.
  - Payment failed emails for subscription renewals (status="payment_failed", kind="subscription")
  - Paused/trial subscriptions (status="paused" or "trial", kind="subscription")
  - Subscription confirmation emails even with $0 (status="active", kind="subscription")
- Use kind="one_time_purchase" for one-off orders, deliveries, tickets, ads top-ups, etc.
- Use kind="marketing" / "newsletter" for promos, discounts, announcements with no billing.

Amount rules (very important):
- amount must be numeric only.
- Prefer the ACTUAL charged amount for this email if present.
- If the email is a trial/receipt with total 0.00 BUT includes the future recurring price (e.g., "you will be charged $11.99 every month", "your plan costs $11.99/month", "renewal will be $11.99"), set amount to that recurring price (11.99).
- If truly no price is present anywhere, set amount to 0. Even with amount=0, if it's clearly a subscription (kind="subscription"), still classify it as a subscription.

Service rules:
- service: Raw service name as it appears in the email (e.g., "Tinder Dating App: Date & Chat", "Apple Services", "Netflix")
- service_canonical: Clean, canonical name without extra text (e.g., "Tinder", "Apple", "Netflix"). Remove app store suffixes, colons, extra descriptions.
- provider: Detect from sender domain - "apple" for @apple.com/@email.apple.com, "google" for @google.com/@googleplay-noreply, "stripe" for @stripe.com, "direct" for others, null if uncertain.
- product_name: Optional specific product if different from service (e.g., if service="Apple" but product is "iCloud+", set product_name="iCloud+")
- Use sender and subject strongly; if it's clearly about billing/subscription, do NOT leave service null.

Status rules:
- payment failed / declined / couldn't process -> status="payment_failed" and kind should still be "subscription" if it's a renewal/subscription context.
- paused -> status="paused".
- trial -> status="trial".
- canceled -> status="canceled".
- default to active if uncertain.

Billing cycle rules:
- If monthly/yearly/weekly is stated, set billingCycle accordingly.
- If it’s clearly a one-off charge, set billingCycle="one_time" and kind="one_time_purchase".
- Otherwise billingCycle="unknown".

Next renewal rules:
- If a next billing/renewal date is clearly stated, return it as YYYY-MM-DD.
- Otherwise null.

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
          content:
            "Extract billing details in JSON only. Classify subscriptions broadly: include trials, paused memberships, and failed renewal payments as kind=subscription when the email indicates an ongoing plan. Use one_time_purchase for one-off orders. No extra fields.",
        },
        { role: "user", content: prompt },
      ],
    });
    const message = response.choices[0]?.message?.content;
    if (!message) return null;
    const data = JSON.parse(message);
    // Fallback: if service missing, attempt from metadata
    if (!data.service) {
      const fallback = fallbackServiceFromMeta(subject, from);
      if (fallback) data.service = fallback;
    }
    // Ensure status is valid
    const validStatuses = [
      "active",
      "trial",
      "cancel_soon",
      "canceled",
      "paused",
      "payment_failed",
    ];
    if (!data.status || !validStatuses.includes(data.status)) {
      data.status = "active";
    }
    // Ensure kind default
    if (!data.kind) data.kind = "other";
    // Ensure confidence is set (default 0.8 if not provided)
    if (typeof data.confidence !== "number" || data.confidence < 0 || data.confidence > 1) {
      data.confidence = 0.8;
    }
    
    // Log extraction for debugging
    // eslint-disable-next-line no-console
    console.log("[ai] extracted subscription", {
      subject,
      from,
      service: data.service,
      service_canonical: data.service_canonical,
      provider: data.provider,
      product_name: data.product_name,
      category: data.category,
      amount: data.amount,
      kind: data.kind,
      confidence: data.confidence,
    });
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("extractSubscription error", err);
    return null;
  }
}
