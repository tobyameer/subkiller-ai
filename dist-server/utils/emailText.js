/**
 * Email text extraction and cleaning utilities
 * Preserves important billing information while removing noise
 */

/**
 * Extract the best text representation from Gmail message payload
 * Prefers text/plain, falls back to text/html with HTML stripped
 */
export function getBestEmailText(payload) {
  if (!payload) return "";

  // Helper to recursively extract text from parts
  const extractFromPart = (part) => {
    if (!part) return "";

    // If this part has a body with data, return it
    if (part.body?.data) {
      try {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      } catch (e) {
        return "";
      }
    }

    // If this part has parts (multipart), recurse
    if (part.parts && Array.isArray(part.parts)) {
      let text = "";
      // Prefer text/plain over text/html
      const plainPart = part.parts.find((p) => p.mimeType === "text/plain");
      const htmlPart = part.parts.find((p) => p.mimeType === "text/html");

      if (plainPart) {
        text = extractFromPart(plainPart);
        if (text) return text;
      }
      if (htmlPart) {
        text = extractFromPart(htmlPart);
        if (text) return stripHtml(text);
      }

      // Fallback: try all parts
      for (const subPart of part.parts) {
        const subText = extractFromPart(subPart);
        if (subText) {
          if (subPart.mimeType === "text/html") {
            return stripHtml(subText);
          }
          return subText;
        }
      }
    }

    return "";
  };

  return extractFromPart(payload);
}

/**
 * Strip HTML tags and decode entities
 * Preserves line breaks and spacing
 */
export function stripHtml(html) {
  if (!html) return "";

  // Decode HTML entities
  let text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Remove script and style tags with their content
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Convert <br>, <p>, <div> to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode more entities
  text = decodeURIComponent(text);

  return text;
}

/**
 * Clean email text while preserving billing information
 * Removes noise but keeps totals, amounts, dates, and billing keywords
 */
export function cleanEmailText(text, maxLength = 4000) {
  if (!text) return "";

  // Split into lines
  let lines = text.split(/\r?\n/);

  // Filter out common noise patterns but preserve billing-related lines
  const noisePatterns = [
    /^unsubscribe/i,
    /^click here to unsubscribe/i,
    /^view in browser/i,
    /^privacy policy/i,
    /^terms of service/i,
    /^copyright/i,
    /^all rights reserved/i,
    /^this email was sent to/i,
    /^you received this email/i,
    /^do not reply/i,
    /^tracking pixel/i,
    /^\[cid:/i, // Email client image placeholders
  ];

  // Keep lines that:
  // 1. Don't match noise patterns
  // 2. OR contain billing keywords (receipt, invoice, total, amount, charged, etc.)
  // 3. OR contain numbers (likely amounts/dates)
  const billingKeywords = /(receipt|invoice|total|amount|charged|payment|billed|subscription|renewal|plan|membership|price|cost|tax|vat|egp|usd|eur|gbp|\$|€|£)/i;
  const hasNumbers = /\d/;

  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Always keep if it has billing keywords or numbers
    if (billingKeywords.test(trimmed) || hasNumbers.test(trimmed)) {
      return true;
    }

    // Otherwise, filter out noise
    return !noisePatterns.some((pattern) => pattern.test(trimmed));
  });

  // Join and truncate
  let cleaned = lines.join("\n").trim();

  // Remove excessive whitespace but preserve structure
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    // Try to cut at a sentence boundary
    const lastPeriod = cleaned.lastIndexOf(".");
    const lastNewline = cleaned.lastIndexOf("\n");
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > maxLength * 0.8) {
      cleaned = cleaned.substring(0, cutPoint + 1);
    }
  }

  return cleaned;
}

