/**
 * Orchestrates AI extraction with input preparation and validation
 */

import { extractSubscription } from "./aiService.js";
import { extractAmountAndCurrency, extractBillingCycle } from "./receiptParser.js";
import { cleanEmailText } from "../utils/emailText.js";

/**
 * Prepare text input for AI extraction
 * Combines and cleans email body + PDF text, with size limits
 */
function prepareAiInput({ subject, from, snippet, bodyText, pdfText, maxLength = 8000 }) {
  // Combine all text sources with structured format
  let combined = "";

  // Add metadata as structured context
  if (subject) combined += `Subject: ${subject}\n`;
  if (from) combined += `From: ${from}\n`;
  if (snippet) combined += `Snippet: ${snippet}\n`;

  combined += "\n--- Email Body ---\n";
  // Allocate 60% to body, 40% to PDF
  combined += cleanEmailText(bodyText || "", Math.floor(maxLength * 0.6));

  if (pdfText) {
    combined += "\n\n--- PDF Attachment Text ---\n";
    const remainingLength = maxLength - combined.length;
    if (remainingLength > 100) {
      combined += cleanEmailText(pdfText, remainingLength);
    }
  }

  // Final truncation if needed
  if (combined.length > maxLength) {
    combined = combined.substring(0, maxLength);
    // Try to cut at sentence boundary
    const lastPeriod = combined.lastIndexOf(".");
    const lastNewline = combined.lastIndexOf("\n");
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > maxLength * 0.8) {
      combined = combined.substring(0, cutPoint + 1);
    }
  }

  return combined.trim();
}

/**
 * Orchestrate AI extraction with fallback parsing
 * @param {Object} params
 * @returns {Promise<Object>} Extracted subscription data
 */
export async function orchestrateExtraction({
  subject,
  from,
  snippet,
  bodyText,
  pdfText,
}) {
  // Prepare AI input
  const aiInput = prepareAiInput({
    subject,
    from,
    snippet,
    bodyText,
    pdfText,
  });

  // Run AI extraction
  let extracted;
  try {
    extracted = await extractSubscription({
      text: aiInput,
      subject,
      from,
      snippet,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[extractionOrchestrator] AI extraction failed", {
      error: err.message,
      subject,
      from,
    });
    // Return minimal extraction
    extracted = {
      service: null,
      amount: 0,
      currency: "USD",
      billingCycle: "unknown",
      status: "active",
      kind: "other",
      category: "Other",
    };
  }

  // Enhance with deterministic parsing if AI missed amount
  const fullText = `${bodyText} ${pdfText}`;
  if ((!extracted.amount || extracted.amount === 0) && fullText) {
    const parsedAmount = extractAmountAndCurrency(fullText);
    if (parsedAmount && parsedAmount.amount > 0) {
      // eslint-disable-next-line no-console
      console.log("[extractionOrchestrator] Using parsed amount", {
        aiAmount: extracted.amount,
        parsedAmount: parsedAmount.amount,
        currency: parsedAmount.currency,
        source: parsedAmount.source,
      });
      extracted.amount = parsedAmount.amount;
      if (!extracted.currency || extracted.currency === "USD") {
        extracted.currency = parsedAmount.currency;
      }
    }
  }

  // Enhance billing cycle if AI returned "unknown"
  if (extracted.billingCycle === "unknown" && fullText) {
    const parsedCycle = extractBillingCycle(fullText);
    if (parsedCycle !== "unknown") {
      // eslint-disable-next-line no-console
      console.log("[extractionOrchestrator] Using parsed cycle", {
        aiCycle: extracted.billingCycle,
        parsedCycle,
      });
      extracted.billingCycle = parsedCycle;
    }
  }

  // Infer service from sender domain if missing
  if (!extracted.service && from) {
    const domainMatch = from.match(/@([a-z0-9.-]+)\./i);
    if (domainMatch) {
      const domain = domainMatch[1];
      // Clean up domain to service name
      const serviceName = domain
        .split(".")
        .filter((part) => part && part !== "com" && part !== "net" && part !== "co")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      if (serviceName) {
        extracted.service = serviceName;
        // eslint-disable-next-line no-console
        console.log("[extractionOrchestrator] Inferred service from domain", {
          domain,
          service: serviceName,
        });
      }
    }
  }

  return extracted;
}

