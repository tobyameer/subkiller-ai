import { NewsletterSubscriberModel } from "../models/NewsletterSubscriber.js";

export async function subscribe(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    // Check if email already exists
    const existing = await NewsletterSubscriberModel.findOne({ email });
    if (existing) {
      return res.status(200).json({ ok: true, message: "Already subscribed" });
    }

    // Create new subscriber
    await NewsletterSubscriberModel.create({ email });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Handle duplicate key error (race condition)
    if (err.code === 11000) {
      return res.status(200).json({ ok: true, message: "Already subscribed" });
    }
    next(err);
  }
}

