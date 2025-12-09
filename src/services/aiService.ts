import { openai } from "../config/openai";
import type { BillingCycle } from "../utils/billingDates";

export type ExtractedKind = "billing_event" | "status_event" | "marketing" | "newsletter" | "other";

export type ExtractedBillingCycle = BillingCycle;
export type StatusEventType =
  | "payment_failed"
  | "on_hold"
  | "canceled"
  | "trial_started"
  | "trial_offer"
  | "renewal_reminder"
  | "card_expiring"
  | "plan_changed"
  | "reactivated"
  | null;

type Extracted = {
  service?: string | null;
  category?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  billingCycle?: ExtractedBillingCycle;
  kind?: ExtractedKind;
  statusEventType?: StatusEventType;
  chargeDate?: string | null;
};
// AI is not responsible for computing dates. nextRenewal is computed on the backend only.

type ExtractInput = {
  text: string;
  subject?: string;
  from?: string;
  snippet?: string;
};

function fallbackServiceFromMeta(subject?: string, from?: string): string | undefined {
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
  const match = candidates.match(/([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/);
  if (match) {
    return match[0].trim();
  }
  return undefined;
}

export async function extractSubscription(input: ExtractInput): Promise<Extracted | null> {
  const { text, subject, from, snippet } = input;
  try {
    const maxBodyLength = 2000;
    const truncatedText = text ? text.slice(0, maxBodyLength) : "";
    const truncatedSnippet = snippet ? snippet.slice(0, 500) : "";
    const prompt = `You are an extraction assistant for subscriptions. Use sender (from), subject, and body to determine if this email is a real subscription/payment/receipt.

Return JSON with keys: service, category, amount, currency, billingCycle, kind, statusEventType, chargeDate.

Rules:
- "kind" must be one of: billing_event, status_event, marketing, newsletter, other.
- billing_event ONLY when: the email confirms a completed or definite charge (receipt/invoice/order confirmation), has a specific amount > 0, and is not about payment failures or holds. Provide chargeDate (ISO if present) and billingCycle (monthly/yearly/weekly/one_time/unknown).
- status_event when the email is about subscription state without a successful charge: payment_failed, on_hold, canceled, trial_started, trial_offer, renewal_reminder, card_expiring, plan_changed, reactivated. Do NOT set billing_event for these.
- marketing/newsletter when advertising prices/plans without confirmed order/charge (e.g., ChatGPT Go LinkedIn newsletter, Bucked Up sale, One Medical trial invite). amount=0.
- Do NOT mark these as billing_event: "Your Prime benefits are on hold due to a billing issue"; "Your talabat pro renewal payment failed"; "Start your One Medical trial"; ChatGPT Go marketing post.
- Bucked Up-style promos (Black Friday, "50% OFF", "THIS WEEKEND ONLY", "USE CODE", "gift guide", "shop now", no receipt/order/charged language) must be marketing with amount=0 and billingCycle="unknown".
- Spotify receipt example ("Your order confirmation", "Thanks for your order!", invoice id, "charge you $X.99 each month until you cancel") must be billing_event, billingCycle=monthly, amount>0, service like Spotify, chargeDate present.
- Talabat subscription fee invoice / subscription e-receipt attached must be billing_event, recurring (billingCycle monthly if unclear), amount>0, service Talabat/Talabat Pro, chargeDate present when available.
- "amount" numeric only and should reflect a real charge. Do NOT treat promotional prices or discounts as charges; if unsure, set amount=0.
- "service" human-readable merchant (Spotify, Talabat, Netflix, etc.). Only null if unrelated to billing.
- "category" one of: Streaming, Music, Gaming, Productivity, Cloud, Finance, Fitness, Retail, Food, Other. Default to Other if unsure.
- "billingCycle" monthly, yearly, weekly, one_time, unknown. If one-off payment, use one_time. Do not guess dates—only classify the cycle.
- Contract-style language like "we will charge you every month until you cancel" should be treated as billing_event with billingCycle=monthly (and amount if present), even if this is the first/only email.
- Do NOT infer cancellation just because there are no future emails. Only set canceled/ended when the email explicitly says it ended or will not renew.
- currency ISO code; default USD if missing.
- If not sure a real charge happened, set amount to 0 and classify as marketing/newsletter/other.
- Do not invent or guess any dates beyond chargeDate when clearly present.

Context:
Sender: ${from ?? "N/A"}
Subject: ${subject ?? "N/A"}
Snippet: ${truncatedSnippet}
Body:
${truncatedText}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract subscription details in JSON only. Be conservative: only call something a subscription/charge when there is a clear billed amount; otherwise prefer marketing/other and set amount to 0 for discounts or uncertain charges. Treat explicit contract language like \"we will charge you every month until you cancel\" as recurring monthly billing_event. Never guess renewal dates—only classify billing cycles. Never infer cancellation just because no future emails are present.",
        },
        { role: "user", content: prompt },
      ],
    });

    const message = response.choices[0]?.message?.content;
    if (!message) return null;
    const data = JSON.parse(message) as Extracted;

    // Fallback: if service missing, attempt from metadata
    if (!data.service) {
      const fallback = fallbackServiceFromMeta(subject, from);
      if (fallback) data.service = fallback;
    }
    // Ensure defaults
    if (!data.kind) data.kind = "other";
    if (!data.billingCycle) data.billingCycle = "unknown";
    if (!data.currency) data.currency = "USD";
    if (!data.statusEventType) data.statusEventType = null;

    // Ensure amount is numeric when possible
    if (typeof data.amount === "string") {
      const parsed = Number(data.amount);
      data.amount = Number.isFinite(parsed) ? parsed : data.amount;
    }

    // Log extraction for debugging
    // eslint-disable-next-line no-console
      console.log("[ai] extracted subscription", {
        subject,
        from,
        service: data.service,
        category: data.category,
        amount: data.amount,
        kind: data.kind,
        billingCycle: data.billingCycle,
      });

    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("extractSubscription error", err);
    return null;
  }
}
