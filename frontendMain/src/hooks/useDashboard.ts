import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DashboardSummary {
  lifetimeTotal: number;
  monthlyRecurring: number;
  activeCount: number;
  last6Months: { key: string; label: string; total: number }[];
}

export function useDashboardSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard-summary"],
    enabled,
    queryFn: async () => api.get<DashboardSummary>("/api/dashboard/summary"),
  });
}

export interface RecentCharge {
  id: string;
  service: string;
  amount: number;
  currency: string;
  chargedAt?: string;
  subscriptionId?: string;
  status?: string;
  subject?: string;
}

export function useRecentCharges(enabled: boolean) {
  return useQuery({
    queryKey: ["recent-charges"],
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: RecentCharge[] }>("/api/dashboard/recent-charges?limit=6");
      return res.items || [];
    },
  });
}
