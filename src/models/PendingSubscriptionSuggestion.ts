import { Schema, model, Types } from "mongoose";
import type { BillingCycle } from "../utils/billingDates";

export type SuggestionStatus = "pending" | "accepted" | "ignored";

export interface PendingSubscriptionSuggestion {
  user: Types.ObjectId;
  gmailMessageId: string;
  subject: string;
  from: string;
  service: string | null;
  amount: number;
  currency: string;
  category: string;
  billingCycle?: BillingCycle;
  chargedAt: Date;
  kind: string;
  status: SuggestionStatus;
  createdAt: Date;
}

const SuggestionSchema = new Schema<PendingSubscriptionSuggestion>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gmailMessageId: { type: String, required: true },
    subject: { type: String, required: true },
    from: { type: String, required: true },
    service: { type: String, required: false, default: null },
    amount: { type: Number, required: false, default: 0 },
    currency: { type: String, required: false, default: "USD" },
    category: { type: String, required: false, default: "Other" },
    billingCycle: { type: String, enum: ["monthly", "yearly", "weekly", "one_time", "unknown"], default: "unknown" },
    chargedAt: { type: Date, required: true, default: Date.now },
    kind: { type: String, required: false, default: "other" },
    status: { type: String, enum: ["pending", "accepted", "ignored"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const PendingSubscriptionSuggestionModel = model<PendingSubscriptionSuggestion>(
  "PendingSubscriptionSuggestion",
  SuggestionSchema,
);
