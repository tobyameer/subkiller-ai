/**
 * Gmail attachment handling and PDF extraction
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * List all attachments in a Gmail message payload
 * @param {Object} payload - Gmail message payload
 * @returns {Array} Array of {filename, mimeType, attachmentId, partId}
 */
export function listAttachments(payload) {
  if (!payload) return [];

  const attachments = [];

  const extractFromPart = (part, partId = null) => {
    if (!part) return;

    // Check if this part is an attachment
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        attachmentId: part.body.attachmentId,
        partId: partId || part.partId,
        size: part.body.size || 0,
      });
    }

    // Recurse into nested parts
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach((subPart, idx) => {
        extractFromPart(subPart, subPart.partId || `${partId || ""}.${idx}`);
      });
    }
  };

  extractFromPart(payload);

  return attachments;
}

/**
 * Fetch an attachment from Gmail
 * @param {Object} gmail - Authorized Gmail client
 * @param {string} messageId - Gmail message ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Buffer>} Attachment data as Buffer
 */
export async function fetchAttachment(gmail, messageId, attachmentId) {
  try {
    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    if (!response.data.data) {
      throw new Error("No attachment data returned");
    }

    return Buffer.from(response.data.data, "base64");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gmailAttachments] Failed to fetch attachment", {
      messageId: messageId?.substring(0, 20),
      attachmentId: attachmentId?.substring(0, 20),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Extract text from a PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @param {number} maxSizeMB - Maximum PDF size to parse (default 2MB)
 * @returns {Promise<string>} Extracted text
 */
export async function pdfToText(buffer, maxSizeMB = 2) {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    // eslint-disable-next-line no-console
    console.warn("[gmailAttachments] PDF too large, skipping", {
      size: buffer.length,
      maxSize: maxSizeBytes,
    });
    return "";
  }

  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gmailAttachments] PDF parsing failed", {
      error: err.message,
      bufferSize: buffer.length,
    });
    return "";
  }
}

/**
 * Extract text from all PDF attachments in a message
 * @param {Object} gmail - Authorized Gmail client
 * @param {string} messageId - Gmail message ID
 * @param {Object} payload - Gmail message payload
 * @param {number} maxTextLength - Maximum total text length (default 8000)
 * @returns {Promise<string>} Combined text from all PDFs (capped at maxTextLength)
 */
export async function extractPdfTexts(gmail, messageId, payload, maxTextLength = 8000) {
  const attachments = listAttachments(payload);
  const pdfAttachments = attachments.filter(
    (att) =>
      att.mimeType === "application/pdf" ||
      att.filename?.toLowerCase().endsWith(".pdf")
  );

  if (pdfAttachments.length === 0) {
    return "";
  }

  // eslint-disable-next-line no-console
  console.log("[gmailAttachments] Found PDF attachments", {
    messageId: messageId?.substring(0, 20),
    count: pdfAttachments.length,
    filenames: pdfAttachments.map((a) => a.filename),
  });

  const pdfTexts = [];
  let totalLength = 0;

  for (const pdfAtt of pdfAttachments) {
    if (totalLength >= maxTextLength) {
      // eslint-disable-next-line no-console
      console.log("[gmailAttachments] Reached max text length, skipping remaining PDFs");
      break;
    }

    try {
      const buffer = await fetchAttachment(
        gmail,
        messageId,
        pdfAtt.attachmentId
      );
      const text = await pdfToText(buffer);
      if (text) {
        // Cap individual PDF text to remaining space
        const remainingSpace = maxTextLength - totalLength;
        const cappedText = text.length > remainingSpace 
          ? text.substring(0, remainingSpace)
          : text;
        
        pdfTexts.push(cappedText);
        totalLength += cappedText.length;
        
        // eslint-disable-next-line no-console
        console.log("[gmailAttachments] Extracted PDF text", {
          filename: pdfAtt.filename,
          textLength: cappedText.length,
          totalLength,
          preview: cappedText.substring(0, 100),
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[gmailAttachments] Failed to extract PDF", {
        filename: pdfAtt.filename,
        error: err.message,
      });
      // Continue with other PDFs
    }
  }

  return pdfTexts.join("\n\n");
}
