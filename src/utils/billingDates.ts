export type BillingCycle = "monthly" | "yearly" | "weekly" | "one_time" | "unknown";

export function computeNextRenewal(chargedAt: Date, billingCycle: BillingCycle): Date | null {
  const base = new Date(chargedAt);
  if (Number.isNaN(base.getTime())) return null;

  switch (billingCycle) {
    case "monthly": {
      const next = new Date(base);
      next.setMonth(base.getMonth() + 1);
      return next;
    }
    case "yearly": {
      const next = new Date(base);
      next.setFullYear(base.getFullYear() + 1);
      return next;
    }
    case "weekly": {
      const next = new Date(base);
      next.setDate(base.getDate() + 7);
      return next;
    }
    case "one_time":
    case "unknown":
    default:
      return null;
  }
}

export function computeMonthlyAmount(billingCycle: BillingCycle, amount: number): number {
  switch (billingCycle) {
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    case "weekly":
      return amount * (52 / 12);
    default:
      return 0;
  }
}
