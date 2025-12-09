import { Schema, model, Types } from "mongoose";
import { BillingCycle } from "../utils/billingDates";

export type SubscriptionStatus = "active" | "past_due" | "on_hold" | "canceled" | "trial" | "expired" | "unknown";

export interface Subscription {
  userId: Types.ObjectId;
  service: string;
  category?: string;
  currency: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  autoCanceled?: boolean;
  monthlyAmount: number;
  estimatedMonthlySpend: number;
  firstChargeAt: Date | null;
  lastChargeAt: Date | null;
  nextRenewal: Date | null;
  totalSpentLast30d?: number;
  totalCharges: number;
  totalAmount: number;
  sourceServiceKey?: string;
  createdAt: Date;
}

const SubscriptionSchema = new Schema<Subscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: String, required: true },
    category: { type: String, required: false, default: "Other" },
    currency: { type: String, default: "USD" },
    billingCycle: { type: String, enum: ["monthly", "yearly", "weekly", "one_time", "unknown"], default: "unknown" },
    status: {
      type: String,
      enum: ["active", "past_due", "on_hold", "canceled", "trial", "expired", "unknown"],
      default: "active",
    },
    autoCanceled: { type: Boolean, default: false },
    monthlyAmount: { type: Number, required: true, default: 0 },
    estimatedMonthlySpend: { type: Number, required: true, default: 0 },
    firstChargeAt: { type: Date, required: false, default: null },
    lastChargeAt: { type: Date, required: false, default: null },
    nextRenewal: { type: Date, required: false, default: null },
    totalCharges: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    totalSpentLast30d: { type: Number, required: false },
    sourceServiceKey: { type: String, required: false },
    providerName: { type: String, required: false },
    manageUrl: { type: String, required: false, default: null },
    deletedAt: { type: Date, required: false, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ userId: 1, service: 1, currency: 1 }, { unique: true });

export const SubscriptionModel = model<Subscription>("Subscription", SubscriptionSchema);
