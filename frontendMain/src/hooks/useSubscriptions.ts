import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CardTransaction, Charge, Subscription, SubscriptionDetails } from "@/types";
import { toast } from "sonner";

const normalizeSubscription = (raw: any): Subscription => ({
  id: raw._id || raw.id,
  service: raw.service || "Unknown",
  status: raw.status || "active",
  amount: raw.amount ?? 0,
  monthlyAmount: raw.monthlyAmount ?? raw.estimatedMonthlySpend ?? raw.amount ?? 0,
  estimatedMonthlySpend: raw.estimatedMonthlySpend ?? raw.monthlyAmount ?? raw.amount ?? 0,
  totalAmount: raw.totalAmount ?? 0,
  totalCharges: raw.totalCharges ?? 0,
  billingCycle: raw.billingCycle || "unknown",
  lastChargeAt: raw.lastChargeAt,
  nextRenewal: raw.nextRenewal,
  deletedAt: raw.deletedAt,
  sourceConfidence: raw.sourceConfidence,
  plaidLinked: raw.plaidLinked,
});

const normalizeCharge = (raw: any): Charge => ({
  id: raw._id || raw.id,
  subscriptionId: raw.subscriptionId,
  amount: raw.amount ?? 0,
  currency: raw.currency || "USD",
  billingCycle: raw.billingCycle || "unknown",
  chargedAt: raw.chargedAt || raw.createdAt,
  gmailMessageId: raw.gmailMessageId,
  gmailThreadId: raw.gmailThreadId,
  subject: raw.subject,
  from: raw.from,
  status: raw.status,
});

const normalizeCardTx = (raw: any): CardTransaction => ({
  id: raw._id || raw.id || raw.transactionId,
  transactionId: raw.transactionId,
  merchantName: raw.merchantName,
  merchantNormalized: raw.merchantNormalized,
  amount: raw.amount ?? 0,
  currency: raw.currency || "USD",
  date: raw.date,
  pending: raw.pending,
});

export function useSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const res = await api.get<{ items: any[] }>("/api/subscriptions?includeDeleted=true");
      return (res.items || []).map(normalizeSubscription);
    },
    enabled,
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Delete failed"),
  });
}

export function useRestoreSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/subscriptions/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription restored");
    },
    onError: (err: any) => toast.error(err?.message || "Restore failed"),
  });
}

export function useScanGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "incremental" | "full") => api.post(`/api/scan/gmail`, { mode }),
    onSuccess: (res: any) => {
      toast.success("Scan complete");
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["gmail-status"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: async (err: any) => {
      const code = err?.code;
      const message = err?.message || "Scan failed";
      if (code === "PLAN_LIMIT") {
        toast.error("Scan limit reached. Upgrade to Pro for unlimited scans.");
        await qc.invalidateQueries({ queryKey: ["me"] });
        return;
      }
      if (code === "GMAIL_PERMISSION") {
        toast.error("Gmail permissions missing. Please reconnect.");
        await qc.invalidateQueries({ queryKey: ["gmail-status"] });
        return;
      }
      const reconnect = message.includes("Reconnect Gmail");
      const misconfigured = message.includes("Server Google OAuth misconfigured");
      if (misconfigured) {
        toast.error("Server Gmail OAuth misconfigured. Check GOOGLE_* envs.");
        return;
      }
      if (reconnect) {
        toast.error("Reconnect Gmail", {
          action: {
            label: "Reconnect",
            onClick: async () => {
              try {
                const res = await api.get<{ url: string }>(`/api/gmail/auth-url`);
                if (res?.url) window.location.href = res.url;
              } catch (linkErr: any) {
                toast.error(linkErr?.message || "Failed to start Gmail reconnect");
              }
            },
          },
        });
        return;
      }
      toast.error(message);
    },
  });
}

export function useSubscriptionDetails(id?: string | null) {
  return useQuery({
    queryKey: ["subscription-details", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ subscription: any; charges: any[] }>(`/api/subscriptions/${id}/details`);
      return {
        subscription: normalizeSubscription(res.subscription),
        charges: (res.charges || []).map(normalizeCharge),
      } as SubscriptionDetails;
    },
  });
}

export function useCardTransactions(id?: string | null) {
  return useQuery({
    queryKey: ["subscription-card", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<{ items: any[] }>(`/api/subscriptions/${id}/transactions`);
      return (res.items || []).map(normalizeCardTx);
    },
  });
}
