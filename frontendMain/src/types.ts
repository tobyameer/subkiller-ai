export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  country?: string;
  marketingOptIn?: boolean;
  plan?: "basic" | "pro";
  gmailConnected?: boolean;
  gmailEmail?: string | null;
  plaidLinked?: boolean;
}

export type BillingCycle = "monthly" | "yearly" | "weekly" | "one_time" | "unknown";

export interface Subscription {
  id: string;
  service: string;
  status: string;
  amount?: number;
  monthlyAmount?: number;
  estimatedMonthlySpend?: number;
  totalAmount?: number;
  totalCharges?: number;
  billingCycle?: BillingCycle;
  lastChargeAt?: string;
  nextRenewal?: string;
  deletedAt?: string;
  sourceConfidence?: string;
  plaidLinked?: boolean;
}

export interface Charge {
  id: string;
  subscriptionId?: string;
  amount: number;
  currency?: string;
  billingCycle?: BillingCycle;
  chargedAt?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  subject?: string;
  from?: string;
  status?: string;
}

export interface CardTransaction {
  id: string;
  transactionId?: string;
  merchantName?: string;
  merchantNormalized?: string;
  amount: number;
  currency?: string;
  date?: string;
  pending?: boolean;
}

export interface SubscriptionDetails {
  subscription: Subscription;
  charges: Charge[];
  cardTransactions?: CardTransaction[];
}
