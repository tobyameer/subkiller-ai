/**
 * Unit tests for computeConfidenceLevel function
 * Run with: node --test dist-server/tests/computeConfidenceLevel.test.js
 */

import { test } from "node:test";
import assert from "node:assert";

// Copy of computeConfidenceLevel logic for testing
function computeConfidenceLevel(
  extracted,
  subject,
  from,
  bodyText,
  cleanedBodyText,
  normalizedAmount
) {
  const text = `${subject || ""} ${bodyText || ""}`.toLowerCase();
  let level = 3; // Default ambiguous

  const failedOrRefundKeywords =
    /(payment failed|failed|declined|was declined|couldn't be processed|unable to process|unsuccessful|chargeback|refunded|refund|reversed|voided|void|canceled|cancelled|dispute|authorization hold|auth hold)/i;
  const subscriptionSignals =
    /(subscription|renewal|recurring|monthly|annual|yearly|next billing|auto-renew|billed every)/i;
  const amountSignals =
    /(\$|€|£)\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl|chf|nzd|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|krw|thb|sgd|hkd|php|idr|myr|vnd)\b\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl|chf|nzd|sek|nok|dkk|pln|czk|huf|ron|bgn|hrk|rub|try|zar|krw|thb|sgd|hkd|php|idr|myr|vnd)\b|\b(total|amount|sum|price|cost|charge|charged|paid|billed|subtotal|grand total)\b[^0-9]{0,20}\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/i;
  const promoSignals =
    /(sale|discount|offer|promo|newsletter|unsubscribe|deal|% off|percent off|gift guide|welcome|survey|marketing)/i;

  // Level 5: High-impact - always require review
  if (failedOrRefundKeywords.test(text) && subscriptionSignals.test(text)) {
    return 5;
  }
  if (amountSignals.test(text) && subscriptionSignals.test(text)) {
    return 5;
  }
  if (
    extracted.status === "payment_failed" &&
    extracted.kind === "subscription"
  ) {
    return 5;
  }
  if (
    extracted.kind === "subscription" &&
    normalizedAmount > 0 &&
    subscriptionSignals.test(text)
  ) {
    return 5; // Recurring renewal receipts
  }

  // Level 4: Likely subscription but missing key fields
  if (subscriptionSignals.test(text) && !amountSignals.test(text)) {
    return 4;
  }
  if (["trial", "paused", "cancel_soon"].includes(extracted.status)) {
    return 4;
  }
  if (
    extracted.kind === "subscription" &&
    (normalizedAmount === 0 || !normalizedAmount)
  ) {
    return 4; // Subscription but amount missing
  }

  // Level 2: One-time purchase
  if (
    /(order confirmation|shipped|delivery|tracking|your order has been)/i.test(
      text
    )
  ) {
    return 2;
  }
  if (extracted.kind === "one_time_purchase") {
    return 2;
  }

  // Level 1: Promo/newsletter
  if (promoSignals.test(text) && !subscriptionSignals.test(text)) {
    return 1;
  }
  if (extracted.kind === "marketing" || extracted.kind === "newsletter") {
    return 1;
  }

  return level; // 3 = ambiguous
}

test("Level 5: Payment failed with subscription", () => {
  const result = computeConfidenceLevel(
    { status: "payment_failed", kind: "subscription" },
    "Payment failed for your subscription",
    "billing@example.com",
    "Your payment failed for Netflix subscription",
    "",
    0
  );
  assert.strictEqual(result, 5);
});

test("Level 5: Amount + subscription signals", () => {
  const result = computeConfidenceLevel(
    { kind: "subscription", amount: 9.99 },
    "Netflix Monthly Charge",
    "billing@netflix.com",
    "You were charged $9.99 for your monthly subscription",
    "",
    9.99
  );
  assert.strictEqual(result, 5);
});

test("Level 4: Subscription signals but no amount", () => {
  const result = computeConfidenceLevel(
    { kind: "subscription" },
    "Your subscription is active",
    "billing@example.com",
    "Your subscription will renew next month",
    "",
    0
  );
  assert.strictEqual(result, 4);
});

test("Level 4: Trial status", () => {
  const result = computeConfidenceLevel(
    { status: "trial", kind: "subscription" },
    "Trial started",
    "billing@example.com",
    "Your free trial has started",
    "",
    0
  );
  assert.strictEqual(result, 4);
});

test("Level 3: Ambiguous (default)", () => {
  const result = computeConfidenceLevel(
    { kind: "other" },
    "Receipt",
    "noreply@example.com",
    "Thank you for your purchase",
    "",
    0
  );
  assert.strictEqual(result, 3);
});

test("Level 2: One-time purchase", () => {
  const result = computeConfidenceLevel(
    { kind: "one_time_purchase" },
    "Order confirmation",
    "orders@example.com",
    "Your order has been shipped",
    "",
    29.99
  );
  assert.strictEqual(result, 2);
});

test("Level 1: Promo email", () => {
  const result = computeConfidenceLevel(
    { kind: "marketing" },
    "Special offer - 50% off",
    "marketing@example.com",
    "Get 50% off your next purchase",
    "",
    0
  );
  assert.strictEqual(result, 1);
});

test("Level 1: Newsletter", () => {
  const result = computeConfidenceLevel(
    { kind: "newsletter" },
    "Weekly newsletter",
    "newsletter@example.com",
    "Check out our latest updates",
    "",
    0
  );
  assert.strictEqual(result, 1);
});

test("Level 5: Recurring renewal with amount", () => {
  const result = computeConfidenceLevel(
    { kind: "subscription", amount: 14.99 },
    "Spotify Premium Renewal",
    "billing@spotify.com",
    "Your monthly subscription has been renewed for $14.99",
    "",
    14.99
  );
  assert.strictEqual(result, 5);
});

test("Level 4: Paused subscription", () => {
  const result = computeConfidenceLevel(
    { status: "paused", kind: "subscription" },
    "Subscription paused",
    "billing@example.com",
    "Your subscription has been paused",
    "",
    0
  );
  assert.strictEqual(result, 4);
});

