import { NewsletterSubscriberModel } from "../models/NewsletterSubscriber.js";
import { sendNewsletterConfirmation } from "../services/emailService.js";

export async function subscribe(req, res, next) {
  try {
    const { email } = req.body;

    // eslint-disable-next-line no-console
    console.log("[newsletter] Subscribe request received", { email });

    // Validate email
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      // eslint-disable-next-line no-console
      console.log("[newsletter] Invalid email format", { email });
      return res.status(400).json({
        ok: false,
        message: "Valid email is required",
      });
    }

    let emailSaved = false;
    let isNewSubscriber = false;

    // Check if email already exists
    const existing = await NewsletterSubscriberModel.findOne({ email });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log("[newsletter] Email already subscribed", { email });
      emailSaved = true; // Already in database
      // Still attempt to send email for existing subscribers (idempotent)
    } else {
      // Create new subscriber
      try {
        await NewsletterSubscriberModel.create({ email });
        emailSaved = true;
        isNewSubscriber = true;
        // eslint-disable-next-line no-console
        console.log("[newsletter] Email saved to database", { email });
      } catch (createErr) {
        // Handle duplicate key error (race condition)
        if (createErr.code === 11000) {
          // eslint-disable-next-line no-console
          console.log("[newsletter] Email already exists (race condition)", {
            email,
          });
          emailSaved = true;
        } else {
          throw createErr;
        }
      }
    }

    // Attempt to send confirmation email (non-blocking, graceful failure)
    let emailSent = false;
    let emailMode = null;
    let messageId = null;

    // Email sending doesn't block - save to DB first, then send
    const emailResult = await sendNewsletterConfirmation(email);
    emailSent = emailResult.success && !emailResult.mock; // True if actually sent
    emailMode = emailResult.mock ? "mock" : "resend";
    messageId = emailResult.messageId;

    if (emailResult.mock) {
      // eslint-disable-next-line no-console
      console.log("[newsletter] Email logged (mock mode)", {
        email,
        mode: emailMode,
      });
    } else if (emailResult.success) {
      // eslint-disable-next-line no-console
      console.log("[newsletter] Email sent successfully", {
        email,
        messageId: emailResult.messageId,
        mode: emailMode,
      });
    } else {
      // Email failed but we don't fail the request
      // eslint-disable-next-line no-console
      console.warn("[newsletter] Email sending failed (non-blocking)", {
        email,
        error: emailResult.error,
        mode: emailMode,
      });
    }

    // Always return success if email was saved to DB
    // Email sending failure doesn't fail the subscription
    const response = {
      ok: true,
      emailSaved,
      emailSent,
      mode: emailMode,
    };

    if (messageId) {
      response.messageId = messageId;
    }

    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[newsletter] Subscribe error", {
      error: err.message,
      code: err.code,
    });
    next(err);
  }
}
