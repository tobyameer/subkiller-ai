/**
 * Tests for subscription presence detection
 */

import { detectSubscriptionPresence } from "../services/subscriptionPresence.js";

// Test cases
const testCases = [
  {
    name: "Apple subscription confirmed (minimal body)",
    input: {
      subject: "Subscription confirmed",
      from: "noreply@apple.com",
      snippet: "Your subscription to Apple Music is now active",
      bodyText: "Subscription confirmed. You will be charged $9.99 every month.",
      pdfText: "",
    },
    expected: { presence: true, confidence: ">0.3" },
  },
  {
    name: "Talabat PDF invoice",
    input: {
      subject: "Talabat Pro Invoice",
      from: "noreply@talabat.com",
      snippet: "Your Talabat Pro invoice",
      bodyText: "Thank you for your subscription",
      pdfText: "Tax Invoice\nTalabat Pro\nTotal: EGP 79.00\nNext billing: 01/02/2024",
    },
    expected: { presence: true, confidence: ">0.3" },
  },
  {
    name: "Spotify receipt with PDF",
    input: {
      subject: "Receipt for your Spotify Premium payment",
      from: "receipts@spotify.com",
      snippet: "Receipt for $5.99",
      bodyText: "Thank you for your payment",
      pdfText: "Receipt\nSpotify Premium\nTotal: $5.99 USD\nBilled monthly",
    },
    expected: { presence: true, confidence: ">0.3" },
  },
  {
    name: "OpenAI receipt",
    input: {
      subject: "OpenAI Invoice",
      from: "billing@openai.com",
      snippet: "Invoice #12345 Amount: $20.00",
      bodyText: "Invoice #12345\nAmount: $20.00 USD\nBilling cycle: Monthly",
      pdfText: "",
    },
    expected: { presence: true, confidence: ">0.3" },
  },
  {
    name: "Marketing newsletter (should be false)",
    input: {
      subject: "Special Offer - 50% Off!",
      from: "marketing@example.com",
      snippet: "Get 50% off your first month!",
      bodyText: "Special Offer!\nGet 50% off!\nClick here to subscribe.\nUnsubscribe here.",
      pdfText: "",
    },
    expected: { presence: false },
  },
];

function runTests() {
  console.log("Running subscriptionPresence tests...\n");

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = detectSubscriptionPresence(testCase.input);
    const passedTest =
      result.presence === testCase.expected.presence &&
      (testCase.expected.confidence
        ? eval(`result.confidence ${testCase.expected.confidence}`)
        : true);

    if (passedTest) {
      console.log(`✓ ${testCase.name}`);
      console.log(`  Presence: ${result.presence}, Confidence: ${result.confidence.toFixed(2)}, Reason: ${result.reason}`);
      passed++;
    } else {
      console.log(`✗ ${testCase.name}`);
      console.log(`  Expected presence: ${testCase.expected.presence}, got: ${result.presence}`);
      console.log(`  Confidence: ${result.confidence.toFixed(2)}, Reason: ${result.reason}`);
      failed++;
    }
    console.log("");
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run tests
if (runTests()) {
  console.log("All subscriptionPresence tests passed!");
  process.exit(0);
} else {
  console.log("Some tests failed!");
  process.exit(1);
}

