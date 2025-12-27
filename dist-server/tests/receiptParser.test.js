/**
 * Tests for receipt parser functions
 */

import { extractAmountAndCurrency, extractBillingCycle } from "../services/receiptParser.js";

// Mock Talabat invoice PDF text
const talabatPdfText = `
Tax Invoice
Talabat Pro Subscription
Period: 01/01/2024 - 31/01/2024
Next billing: 01/02/2024

Item: Talabat Pro (1 month)
Amount: EGP 79.00
Total: EGP 79.00
VAT: EGP 0.00
Grand Total: EGP 79.00
`;

// Mock Spotify receipt PDF text
const spotifyPdfText = `
Receipt
Spotify Premium
Item: Premium (1 month)
Price: $5.99 USD
Total: $5.99 USD
Billed monthly
Next billing date: 2024-02-15
`;

// Mock Apple subscription confirmation (minimal body)
const appleMinimalText = `
Subscription confirmed
Your subscription to Apple Music is now active.
You will be charged $9.99 every month.
Next billing: February 15, 2024
`;

// Mock OpenAI receipt
const openaiReceiptText = `
OpenAI
Invoice #12345
Amount: $20.00 USD
Billing cycle: Monthly
Charged on: 2024-01-15
`;

// Mock marketing email (should not extract)
const marketingText = `
Special Offer!
Get 50% off your first month!
Click here to subscribe.
Unsubscribe here.
`;

function testExtractAmountAndCurrency() {
  console.log("Testing extractAmountAndCurrency...");

  // Test Talabat
  const talabatResult = extractAmountAndCurrency(talabatPdfText);
  console.assert(
    talabatResult?.amount === 79.0,
    `Expected 79.0, got ${talabatResult?.amount}`
  );
  console.assert(
    talabatResult?.currency === "EGP",
    `Expected EGP, got ${talabatResult?.currency}`
  );
  console.log("✓ Talabat: amount=79.00 EGP");

  // Test Spotify
  const spotifyResult = extractAmountAndCurrency(spotifyPdfText);
  console.assert(
    spotifyResult?.amount === 5.99,
    `Expected 5.99, got ${spotifyResult?.amount}`
  );
  console.assert(
    spotifyResult?.currency === "USD",
    `Expected USD, got ${spotifyResult?.currency}`
  );
  console.log("✓ Spotify: amount=5.99 USD");

  // Test Apple
  const appleResult = extractAmountAndCurrency(appleMinimalText);
  console.assert(
    appleResult?.amount === 9.99,
    `Expected 9.99, got ${appleResult?.amount}`
  );
  console.log("✓ Apple: amount=9.99 USD");

  // Test OpenAI
  const openaiResult = extractAmountAndCurrency(openaiReceiptText);
  console.assert(
    openaiResult?.amount === 20.0,
    `Expected 20.0, got ${openaiResult?.amount}`
  );
  console.log("✓ OpenAI: amount=20.00 USD");

  // Test marketing (should return null or low amount)
  const marketingResult = extractAmountAndCurrency(marketingText);
  console.log("✓ Marketing: no amount extracted (expected)");

  console.log("extractAmountAndCurrency tests passed!\n");
}

function testExtractBillingCycle() {
  console.log("Testing extractBillingCycle...");

  // Test Talabat (monthly)
  const talabatCycle = extractBillingCycle(talabatPdfText);
  console.assert(
    talabatCycle === "monthly",
    `Expected monthly, got ${talabatCycle}`
  );
  console.log("✓ Talabat: cycle=monthly");

  // Test Spotify (monthly)
  const spotifyCycle = extractBillingCycle(spotifyPdfText);
  console.assert(
    spotifyCycle === "monthly",
    `Expected monthly, got ${spotifyCycle}`
  );
  console.log("✓ Spotify: cycle=monthly");

  // Test Apple (monthly)
  const appleCycle = extractBillingCycle(appleMinimalText);
  console.assert(
    appleCycle === "monthly",
    `Expected monthly, got ${appleCycle}`
  );
  console.log("✓ Apple: cycle=monthly");

  // Test yearly
  const yearlyText = "Annual subscription $99.99 per year";
  const yearlyCycle = extractBillingCycle(yearlyText);
  console.assert(
    yearlyCycle === "yearly",
    `Expected yearly, got ${yearlyCycle}`
  );
  console.log("✓ Yearly: cycle=yearly");

  console.log("extractBillingCycle tests passed!\n");
}

// Run tests
console.log("Running receiptParser tests...\n");
testExtractAmountAndCurrency();
testExtractBillingCycle();
console.log("All tests passed!");

