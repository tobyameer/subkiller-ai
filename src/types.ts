import type { BillingCycle as BillingCycleValue } from "./utils/billingDates";

export type BillingCycle = BillingCycleValue;
export type SubscriptionStatus = "active" | "past_due" | "on_hold" | "canceled" | "trial" | "expired" | "unknown";

export interface Subscription {
  id: string;
  service: string;
  category: string;
  currency: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  autoCanceled?: boolean;
  monthlyAmount: number;
  estimatedMonthlySpend: number;
  firstChargeAt: string | null;
  lastChargeAt: string | null;
  nextRenewal: string | null;
  totalCharges?: number;
  totalAmount: number;
  totalSpentLast30d?: number;
  sourceServiceKey?: string;
  providerName?: string;
  manageUrl?: string | null;
  isDeleted?: boolean;
  createdAt: string;
}

export type SuggestionStatus = "pending" | "accepted" | "ignored";

export interface PendingSubscriptionSuggestion {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  service: string | null;
  amount: number;
  currency: string;
  category: string;
  billingCycle?: BillingCycle;
  chargedAt?: string;
  kind: string;
  status: SuggestionStatus;
  createdAt: string;
}

export interface Charge {
  id: string;
  user: string;
  subscription?: string;
  service: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  kind: string;
  chargedAt: string;
  sourceMessageId: string;
  category?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name?: string;
  email: string;
  subscriptionPlan: "free" | "pro" | "premium";
  gmailConnected?: boolean;
  lastScanDate?: string | null;
}
