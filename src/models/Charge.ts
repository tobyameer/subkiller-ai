import { Schema, model, Types } from "mongoose";
import type { BillingCycle } from "../utils/billingDates";

export interface Charge {
  user: Types.ObjectId;
  subscription?: Types.ObjectId;
  service: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  kind: "subscription" | "one_time_charge" | "marketing" | "newsletter" | "other";
  chargedAt: Date;
  sourceMessageId: string;
  category?: string;
  provider?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChargeSchema = new Schema<Charge>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", required: false },
    service: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, default: "USD" },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "weekly", "one_time", "unknown"],
      default: "unknown",
    },
    kind: {
      type: String,
      enum: ["subscription", "one_time_charge", "marketing", "newsletter", "other"],
      default: "other",
    },
    chargedAt: { type: Date, required: true },
    sourceMessageId: { type: String, required: true },
    category: { type: String, required: false, default: "Other" },
    provider: { type: String, required: false },
  },
  { timestamps: true },
);

ChargeSchema.index({ user: 1, sourceMessageId: 1 }, { unique: true });

export const ChargeModel = model<Charge>("Charge", ChargeSchema);
