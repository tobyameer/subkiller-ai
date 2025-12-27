/**
 * Deterministic receipt parser for extracting amounts, currencies, and billing cycles
 * Works on both email body text and PDF text
 */

/**
 * Extract amount and currency from text
 * @param {string} text - Text to parse
 * @returns {{amount: number, currency: string, source: string} | null}
 */
export function extractAmountAndCurrency(text) {
  if (!text) return null;

  // Currency symbols and codes
  const currencyPatterns = [
    // Symbols
    { pattern: /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i, currency: "USD" },
    { pattern: /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i, currency: "EUR" },
    { pattern: /£\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i, currency: "GBP" },
    // Codes before amount
    {
      pattern: /\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl)\b\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
      currency: null, // Extract from match
    },
    // Codes after amount
    {
      pattern: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*\b(usd|egp|eur|gbp|sar|aed|cad|aud|jpy|cny|inr|mxn|brl)\b/i,
      currency: null, // Extract from match
    },
  ];

  // Total/Amount keywords (prioritize these)
  const totalKeywords = [
    /(?:total|grand total|amount due|amount paid|subtotal|price|cost|charge|charged|paid|billed)[^0-9]{0,30}(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)[^0-9]{0,30}(?:total|grand total|amount due|amount paid)/i,
  ];

  let bestMatch = null;
  let bestPriority = 0; // Higher = better

  // First, try total keywords (highest priority)
  for (const pattern of totalKeywords) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1] || match[2];
      const amount = parseFloat(amountStr.replace(/,/g, ""));
      if (amount > 0) {
        // Try to find currency nearby
        const context = text.substring(
          Math.max(0, match.index - 50),
          Math.min(text.length, match.index + match[0].length + 50)
        );
        let currency = "USD"; // default

        // Check for currency in context
        if (/\b(usd|egp|eur|gbp|sar|aed)\b/i.test(context)) {
          const currencyMatch = context.match(/\b(usd|egp|eur|gbp|sar|aed)\b/i);
          currency = currencyMatch[1].toUpperCase();
        } else if (/\$/.test(context)) {
          currency = "USD";
        } else if (/€/.test(context)) {
          currency = "EUR";
        } else if (/£/.test(context)) {
          currency = "GBP";
        }

        bestMatch = { amount, currency, source: "total_keyword" };
        bestPriority = 10;
        break; // Take first total match
      }
    }
  }

  // If no total keyword match, try currency patterns
  if (!bestMatch) {
    for (const { pattern, currency: defaultCurrency } of currencyPatterns) {
      const match = text.match(pattern);
      if (match) {
        let amountStr;
        let currency = defaultCurrency || "USD";

        if (defaultCurrency) {
          // Symbol pattern: amount is in match[1]
          amountStr = match[1];
        } else {
          // Code pattern: extract from match
          if (match[1] && /\d/.test(match[1])) {
            // Amount first, code second
            amountStr = match[1];
            currency = match[2]?.toUpperCase() || "USD";
          } else {
            // Code first, amount second
            currency = match[1]?.toUpperCase() || "USD";
            amountStr = match[2];
          }
        }

        const amount = parseFloat(amountStr.replace(/,/g, ""));
        if (amount > 0) {
          bestMatch = { amount, currency, source: "currency_pattern" };
          bestPriority = 5;
          break; // Take first valid match
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Extract billing cycle from text
 * @param {string} text - Text to parse
 * @returns {"monthly" | "yearly" | "weekly" | "unknown"}
 */
export function extractBillingCycle(text) {
  if (!text) return "unknown";

  const textLower = text.toLowerCase();

  // Strong indicators
  if (/(?:monthly|per month|each month|every month|monthly subscription|monthly plan)/i.test(textLower)) {
    return "monthly";
  }
  if (/(?:yearly|annual|per year|each year|every year|annual subscription|yearly plan|\(1 year\))/i.test(textLower)) {
    return "yearly";
  }
  if (/(?:weekly|per week|each week|every week|weekly subscription)/i.test(textLower)) {
    return "weekly";
  }

  // Pattern-based detection
  if (/(?:renews?|billed|charged|payment)\s+(?:every|each)\s+(\d+)\s*(?:month|year|week)/i.test(textLower)) {
    const match = textLower.match(/(?:renews?|billed|charged|payment)\s+(?:every|each)\s+(\d+)\s*(month|year|week)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === "month") {
        if (num === 1) return "monthly";
        if (num === 12) return "yearly";
      } else if (unit === "year") {
        return "yearly";
      } else if (unit === "week") {
        if (num === 1) return "weekly";
      }
    }
  }

  // Check for "(1 month)" pattern (common in Spotify/Talabat PDFs)
  if (/\(1\s*month\)/i.test(textLower)) {
    return "monthly";
  }
  if (/\(12\s*months?\)|\(1\s*year\)/i.test(textLower)) {
    return "yearly";
  }

  return "unknown";
}

/**
 * Extract dates from text (last charge, invoice date, next billing)
 * @param {string} text - Text to parse
 * @returns {{lastCharge?: Date, invoiceDate?: Date, nextBilling?: Date}}
 */
export function extractDates(text) {
  if (!text) return {};

  const dates = {};

  // Common date patterns
  const datePatterns = [
    // ISO format: YYYY-MM-DD
    /(\d{4}-\d{2}-\d{2})/,
    // DD/MM/YYYY or MM/DD/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    // DD-MM-YYYY
    /(\d{1,2}-\d{1,2}-\d{4})/,
    // Month DD, YYYY
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  // Look for date keywords
  const lastChargePattern = /(?:charged|paid|billed|payment date|transaction date)[^0-9]{0,30}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;
  const invoiceDatePattern = /(?:invoice date|invoice issued|date)[^0-9]{0,30}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;
  const nextBillingPattern = /(?:next billing|next charge|renews? on|renewal date|next payment)[^0-9]{0,30}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      // Try ISO format first
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
      }
      // Try other formats
      return new Date(dateStr);
    } catch (e) {
      return null;
    }
  };

  const lastChargeMatch = text.match(lastChargePattern);
  if (lastChargeMatch) {
    dates.lastCharge = parseDate(lastChargeMatch[1]);
  }

  const invoiceDateMatch = text.match(invoiceDatePattern);
  if (invoiceDateMatch) {
    dates.invoiceDate = parseDate(invoiceDateMatch[1]);
  }

  const nextBillingMatch = text.match(nextBillingPattern);
  if (nextBillingMatch) {
    dates.nextBilling = parseDate(nextBillingMatch[1]);
  }

  return dates;
}

