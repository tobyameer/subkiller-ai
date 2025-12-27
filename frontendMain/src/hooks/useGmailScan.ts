import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ScanStatus {
  scanId: string;
  status: "running" | "completed" | "failed";
  progress: {
    totalMessages: number;
    processedMessages: number;
    foundCandidates: number;
    pendingReview: number;
    verified: number;
    declined: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ReviewItem {
  _id: string;
  user: string;
  gmailMessageId: string;
  gmailThreadId?: string;
  subject: string;
  from: string;
  date?: string;
  service?: string;
  amount: number;
  currency: string;
  category: string;
  kind: string;
  confidence: number;
  confidenceLevel: number;
  decision: "pending" | "verified" | "declined";
  decisionMeta?: {
    decidedAt?: string;
    editedFields?: Record<string, any>;
    alwaysIgnoreSender?: boolean;
    autoDeclined?: boolean;
    reason?: string;
  };
  cleanedPreview?: string;
  aiExtracted?: {
    service?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    kind?: string;
    status?: string;
    category?: string;
    nextRenewal?: string;
  };
  needsReview: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

// User-friendly scan modes
export type ScanMode = "quick" | "deep" | "debug";

// Start a new scan
export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mode: ScanMode = "quick", debug = false) => {
      const response = await api.post<{ ok: boolean; scanId: string; status: string }>(
        "/api/gmail/scan/start",
        { mode, debug }
      );
      return response;
    },
    onSuccess: (data) => {
      // Invalidate scan status queries to trigger polling
      queryClient.invalidateQueries({ queryKey: ["scanStatus", data.scanId] });
    },
  });
}

// Poll scan status
export function useScanStatus(scanId: string | null) {
  return useQuery({
    queryKey: ["scanStatus", scanId],
    queryFn: async () => {
      if (!scanId) return null;
      const response = await api.get<ScanStatus>(`/api/gmail/scan/status?scanId=${scanId}`);
      return response;
    },
    enabled: !!scanId,
    // Poll every 1.5s while scan is running
    // Polling will stop when scanId becomes null or component unmounts
    refetchInterval: 1500,
  });
}

// Get next pending review item
export function useNextReviewItem() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["reviewItem", "next"],
    queryFn: async () => {
      const response = await api.get<{ item: ReviewItem | null }>("/api/review-items/next");
      return response.item;
    },
    refetchInterval: 2000, // Poll every 2s for new items
  });
}

// Verify a review item
export function useVerifyReviewItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      edits,
      alwaysIgnoreSender,
    }: {
      id: string;
      edits?: {
        service?: string;
        amount?: number;
        billingCycle?: string;
        category?: string;
        status?: string;
      };
      alwaysIgnoreSender?: boolean;
    }) => {
      const response = await api.post<{ ok: boolean; subscription?: any }>(
        `/api/review-items/${id}/verify`,
        {
          ...edits,
          alwaysIgnoreSender,
        }
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["reviewItem"] });
      queryClient.invalidateQueries({ queryKey: ["reviewItems"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["scanStatus"] });
    },
  });
}

// Decline a review item
export function useDeclineReviewItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      alwaysIgnoreSender,
    }: {
      id: string;
      alwaysIgnoreSender?: boolean;
    }) => {
      const response = await api.post<{ ok: boolean }>(`/api/review-items/${id}/decline`, {
        alwaysIgnoreSender,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["reviewItem"] });
      queryClient.invalidateQueries({ queryKey: ["reviewItems"] });
      queryClient.invalidateQueries({ queryKey: ["scanStatus"] });
    },
  });
}

// List review items
export function useReviewItems(decision: "pending" | "verified" | "declined" = "pending", level?: number) {
  return useQuery({
    queryKey: ["reviewItems", decision, level],
    queryFn: async () => {
      const params = new URLSearchParams({ decision });
      if (level !== undefined) {
        params.append("level", level.toString());
      }
      const response = await api.get<{ items: ReviewItem[] }>(`/api/review-items?${params.toString()}`);
      return response.items;
    },
  });
}

