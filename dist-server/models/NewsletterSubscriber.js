import { Schema, model } from "mongoose";

const NewsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const NewsletterSubscriberModel = model(
  "NewsletterSubscriber",
  NewsletterSubscriberSchema
);

