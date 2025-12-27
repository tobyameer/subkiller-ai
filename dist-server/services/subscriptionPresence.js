/**
 * Subscription presence detection (no AI)
 * Determines if an email likely contains subscription/billing information
 */

/**
 * Known subscription/billing sender domains
 */
const KNOWN_BILLING_DOMAINS = [
  /apple\.com/i,
  /spotify\.com/i,
  /talabat\.com/i,
  /openai\.com/i,
  /google\.com/i,
  /netflix\.com/i,
  /amazon\.com/i,
  /microsoft\.com/i,
  /adobe\.com/i,
  /adobe\.net/i,
  /youtube\.com/i,
  /discord\.com/i,
  /github\.com/i,
  /notion\.so/i,
  /figma\.com/i,
  /slack\.com/i,
  /zoom\.us/i,
  /dropbox\.com/i,
  /salesforce\.com/i,
  /shopify\.com/i,
  /stripe\.com/i,
  /paypal\.com/i,
];

/**
 * Positive signals for subscription presence
 */
const SUBSCRIPTION_SIGNALS = [
  /subscription/i,
  /renewal/i,
  /auto-renew/i,
  /renews on/i,
  /will be charged/i,
  /recurring/i,
  /your plan/i,
  /membership/i,
  /premium/i,
  /billing/i,
  /invoice/i,
  /receipt/i,
  /tax invoice/i,
  /next billing/i,
  /next charge/i,
  /payment confirmation/i,
  /order confirmation/i,
  /charged/i,
  /billed/i,
  /paid/i,
];

/**
 * Negative signals (pure marketing/newsletter)
 */
const MARKETING_SIGNALS = [
  /^unsubscribe/i,
  /click here to unsubscribe/i,
  /view in browser/i,
  /newsletter/i,
  /promo code/i,
  /special offer/i,
  /limited time/i,
  /sale ends/i,
  /% off/i,
  /discount code/i,
];

/**
 * Amount/price indicators
 */
const AMOUNT_SIGNALS = [
  /\$\s*\d+(?:[.,]\d{2})?/i,
  /€\s*\d+(?:[.,]\d{2})?/i,
  /£\s*\d+(?:[.,]\d{2})?/i,
  /\b(usd|egp|eur|gbp|sar|aed)\b\s*\d+(?:[.,]\d{2})?/i,
  /\d+(?:[.,]\d{2})?\s*\b(usd|egp|eur|gbp|sar|aed)\b/i,
  /\btotal\b[^0-9]{0,20}\d+(?:[.,]\d{2})?/i,
  /\bamount\b[^0-9]{0,20}\d+(?:[.,]\d{2})?/i,
  /\bprice\b[^0-9]{0,20}\d+(?:[.,]\d{2})?/i,
];

/**
 * Detect if an email likely contains subscription/billing information
 * @param {Object} params
 * @param {string} params.subject - Email subject
 * @param {string} params.from - Sender email/domain
 * @param {string} params.snippet - Gmail snippet
 * @param {string} params.bodyText - Email body text
 * @param {string} params.pdfText - Extracted PDF text
 * @param {boolean} params.hasPdfAttachment - Whether message has PDF attachment
 * @returns {{presence: boolean, reason: string, confidence: number, score: number}}
 */
export function detectSubscriptionPresence({
  subject = "",
  from = "",
  snippet = "",
  bodyText = "",
  pdfText = "",
  hasPdfAttachment = false,
}) {
  // Combine all text sources
  const fullText = `${subject} ${snippet} ${bodyText} ${pdfText}`.toLowerCase();
  const fromLower = from.toLowerCase();

  // Check for known billing domains
  const hasKnownDomain = KNOWN_BILLING_DOMAINS.some((pattern) =>
    pattern.test(fromLower)
  );

  // Check for subscription signals
  const hasSubscriptionSignal = SUBSCRIPTION_SIGNALS.some((pattern) =>
    pattern.test(fullText)
  );

  // Check for amount signals
  const hasAmountSignal = AMOUNT_SIGNALS.some((pattern) => pattern.test(fullText));

  // Check for negative marketing signals (but only if no billing signals)
  const hasMarketingSignal = MARKETING_SIGNALS.some((pattern) =>
    pattern.test(fullText)
  );

  // PDF with invoice/receipt keywords is a strong signal
  const hasPdfInvoice = pdfText && /(invoice|receipt|tax invoice|total|amount)/i.test(pdfText);

  // Calculate confidence/score
  let score = 0;
  let reason = "";

  // Strong signals
  if (hasPdfInvoice) {
    score += 0.4;
    reason += "PDF invoice/receipt; ";
  }
  // Boost for PDF attachment (even if text not extracted yet)
  if (hasPdfAttachment) {
    score += 0.4;
    reason += "PDF attachment present; ";
  }
  if (hasKnownDomain && hasSubscriptionSignal) {
    score += 0.3;
    reason += "Known billing domain + subscription keywords; ";
  }
  if (hasSubscriptionSignal && hasAmountSignal) {
    score += 0.3;
    reason += "Subscription keywords + amount; ";
  }

  // Medium signals
  if (hasSubscriptionSignal && !hasMarketingSignal) {
    score += 0.2;
    reason += "Subscription keywords (no marketing); ";
  }
  if (hasKnownDomain && hasAmountSignal) {
    score += 0.2;
    reason += "Known domain + amount; ";
  }
  if (hasAmountSignal && !hasMarketingSignal) {
    score += 0.1;
    reason += "Amount present (no marketing); ";
  }

  // Weak signals
  if (hasKnownDomain) {
    score += 0.1;
    reason += "Known billing domain; ";
  }

  // Negative: pure marketing without billing
  if (hasMarketingSignal && !hasSubscriptionSignal && !hasAmountSignal && !hasPdfInvoice && !hasPdfAttachment) {
    score = Math.max(0, score - 0.5);
    reason = "Pure marketing/newsletter (no billing signals)";
    return {
      presence: false,
      reason,
      confidence: 0,
      score: 0,
    };
  }

  // Never reject solely because amountSignals missing
  // Threshold: presence if score >= 0.3
  const presence = score >= 0.3;

  if (!presence) {
    reason = `Low score (${score.toFixed(2)}): ${reason || "No strong signals"}`;
  }

  return {
    presence,
    reason: reason.trim() || "No signals detected",
    confidence: Math.min(1, score),
    score,
  };
}

