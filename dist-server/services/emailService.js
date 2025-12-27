/**
 * Email service for sending transactional emails via Resend API
 * Production-safe, works on free hosting (Render free tier)
 */

import { Resend } from "resend";

// Initialize Resend client (lazy initialization)
let resendClient = null;

const getResendClient = () => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      resendClient = new Resend(apiKey);
      // eslint-disable-next-line no-console
      console.log("[email] Resend client initialized");
    } else {
      // eslint-disable-next-line no-console
      console.warn("[email] RESEND_API_KEY not set - emails will be logged only");
    }
  }
  return resendClient;
};

// Check if we should mock emails (development mode or missing API key)
const shouldMockEmail = () => {
  return process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY;
};

// Get from email address
const getFromEmail = () => {
  return process.env.EMAIL_FROM || "SubKiller <no-reply@subkiller.app>";
};

/**
 * Send a generic email via Resend
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content
 * @param {string} [params.text] - Plain text content (optional)
 * @returns {Promise<{success: boolean, messageId?: string, mock: boolean}>}
 */
export async function sendGenericEmail({ to, subject, html, text }) {
  const isMock = shouldMockEmail();

  // Log email payload in development/mock mode
  if (isMock) {
    // eslint-disable-next-line no-console
    console.log("[email:mock] Would send email:", {
      to,
      subject,
      from: getFromEmail(),
    });
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      mock: true,
    };
  }

  // Send via Resend in production
  const client = getResendClient();
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn("[email:mock] RESEND_API_KEY not configured - logging email instead");
    // eslint-disable-next-line no-console
    console.log("[email:mock] Email payload:", { to, subject, from: getFromEmail() });
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      mock: true,
    };
  }

  try {
    const result = await client.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML if no text provided
    });

    // eslint-disable-next-line no-console
    console.log("[email] Sent via Resend", {
      to,
      subject,
      messageId: result.data?.id,
    });

    return {
      success: true,
      messageId: result.data?.id,
      mock: false,
    };
  } catch (error) {
    // Log error but don't throw - graceful failure
    // eslint-disable-next-line no-console
    console.error("[email] Failed to send email via Resend", {
      to,
      subject,
      error: error.message,
      code: error.code,
    });

    // Return failure but don't throw - let caller decide
    return {
      success: false,
      mock: false,
      error: error.message,
    };
  }
}

/**
 * Send newsletter subscription confirmation email
 * @param {string} email - Subscriber email
 * @returns {Promise<{success: boolean, messageId?: string, mock: boolean}>}
 */
export async function sendNewsletterConfirmation(email) {
  const subject = "Welcome to SubKiller Weekly Tips!";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SubKiller</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to SubKiller!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-top: 0;">Hi there,</p>
          <p style="font-size: 16px;">Thanks for subscribing to our weekly savings tips! You'll receive one email per week with:</p>
          <ul style="font-size: 16px; line-height: 1.8;">
            <li>💡 Tips to reduce subscription waste</li>
            <li>📊 Insights on subscription spending trends</li>
            <li>🎯 Ways to optimize your recurring charges</li>
            <li>🔔 Alerts about price increases</li>
          </ul>
          <p style="font-size: 16px;">You can unsubscribe anytime by clicking the link at the bottom of any email.</p>
          <p style="font-size: 16px; margin-bottom: 0;">Happy saving!<br>The SubKiller Team</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>SubKiller - See every charge. Kill the waste.</p>
        </div>
      </body>
    </html>
  `;

  const text = `
Welcome to SubKiller!

Thanks for subscribing to our weekly savings tips! You'll receive one email per week with:
- Tips to reduce subscription waste
- Insights on subscription spending trends
- Ways to optimize your recurring charges
- Alerts about price increases

You can unsubscribe anytime by clicking the link at the bottom of any email.

Happy saving!
The SubKiller Team

---
SubKiller - See every charge. Kill the waste.
  `;

  return sendGenericEmail({
    to: email,
    subject,
    html,
    text,
  });
}
