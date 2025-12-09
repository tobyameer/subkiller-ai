import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, setUnauthorizedHandler } from "../lib/api";
import { SubscriptionStatus, User, Subscription, PendingSubscriptionSuggestion } from "../types";

type AppState = {
  user: User | null;
  subscriptions: Subscription[];
  suggestions: PendingSubscriptionSuggestion[];
  loadingUser: boolean;
  loadingSubscriptions: boolean;
  loadingSuggestions: boolean;
  isScanningGmail: boolean;
  scanProgress: number;
  userFetched: boolean;
  activeSubscriptions: () => Subscription[];
  monthlySpend: () => number;
  lifetimeSpend: () => number;
  loadUser: () => Promise<void>;
  loadSubscriptions: (includeDeleted?: boolean) => Promise<void>;
  loadSuggestions: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSubscriptionStatus: (id: string, status: SubscriptionStatus) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  restoreSubscription: (id: string) => Promise<void>;
  connectGmail: () => Promise<void>;
  scanGmail: (mode?: "incremental" | "full") => Promise<void>;
  startCheckout: (plan: "pro" | "premium") => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  ignoreSuggestion: (id: string) => Promise<void>;
};

const normalizeUser = (raw: any): User => ({
  id: raw._id || raw.id,
  name: raw.name,
  email: raw.email,
  subscriptionPlan: raw.subscriptionPlan || raw.plan || "free",
  gmailConnected: Boolean(raw.gmailTokens?.access),
  lastScanDate: raw.lastScanDate ? new Date(raw.lastScanDate).toISOString() : null,
});

const normalizeSubscription = (raw: any): Subscription => ({
  id: raw._id || raw.id,
  service: raw.service,
  category: raw.category,
  currency: raw.currency,
  billingCycle: raw.billingCycle || "unknown",
  monthlyAmount: raw.monthlyAmount ?? 0,
  estimatedMonthlySpend: raw.estimatedMonthlySpend ?? raw.monthlyAmount ?? 0,
  firstChargeAt: raw.firstChargeAt ? new Date(raw.firstChargeAt).toISOString() : null,
  lastChargeAt: raw.lastChargeAt
    ? new Date(raw.lastChargeAt).toISOString()
    : raw.chargedAt
      ? new Date(raw.chargedAt).toISOString()
      : raw.createdAt
        ? new Date(raw.createdAt).toISOString()
        : null,
  nextRenewal: raw.nextRenewal ? new Date(raw.nextRenewal).toISOString() : null,
  totalCharges: raw.totalCharges ?? 0,
  totalAmount: raw.totalAmount ?? 0,
  totalSpentLast30d: raw.totalSpentLast30d,
  sourceServiceKey: raw.sourceServiceKey,
  status: raw.status,
  autoCanceled: raw.autoCanceled ?? false,
  providerName: raw.providerName,
  manageUrl: raw.manageUrl,
  isDeleted: Boolean(raw.deletedAt),
  createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
});

const normalizeSuggestion = (raw: any): PendingSubscriptionSuggestion => ({
  id: raw._id || raw.id,
  gmailMessageId: raw.gmailMessageId,
  subject: raw.subject,
  from: raw.from,
  service: raw.service,
  amount: raw.amount,
  currency: raw.currency,
  category: raw.category,
  billingCycle: raw.billingCycle || "unknown",
  chargedAt: raw.chargedAt ? new Date(raw.chargedAt).toISOString() : undefined,
  kind: raw.kind,
  status: raw.status,
  createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      subscriptions: [],
      suggestions: [],
      loadingUser: false,
      loadingSubscriptions: false,
      loadingSuggestions: false,
      isScanningGmail: false,
      scanProgress: 0,
      userFetched: false,

      activeSubscriptions: () => {
        const subs = useAppStore.getState().subscriptions.filter((s) => !s.isDeleted);
        return subs.filter(
          (s) =>
            (s.status === "active" || s.status === "trial") &&
            s.estimatedMonthlySpend !== undefined &&
            s.estimatedMonthlySpend > 0,
        );
      },

      monthlySpend: () => {
        const subs = useAppStore.getState().subscriptions.filter((s) => !s.isDeleted);
        return subs
          .filter(
            (s) =>
              (s.status === "active" || s.status === "trial") &&
              s.estimatedMonthlySpend !== undefined &&
              s.estimatedMonthlySpend > 0,
          )
          .reduce((sum, s) => sum + (s.estimatedMonthlySpend || 0), 0);
      },

      lifetimeSpend: () => {
        const subs = useAppStore.getState().subscriptions.filter((s) => !s.isDeleted);
        return subs.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      },

      loadUser: async () => {
        if (get().loadingUser) return;
        set({ loadingUser: true });
        try {
          const res = await api.get<{ user?: any }>("/auth/me");
          if (res?.user) {
            set({ user: normalizeUser(res.user), userFetched: true });
          } else {
            set({ user: null, userFetched: true, subscriptions: [] });
          }
        } catch (err) {
          set({ user: null, userFetched: true, subscriptions: [] });
        } finally {
          set({ loadingUser: false });
        }
      },

      loadSubscriptions: async (includeDeleted = false) => {
        if (!get().user) return;
        set({ loadingSubscriptions: true });
        try {
          const query = includeDeleted ? "?includeDeleted=true" : "";
          const res = await api.get<{ items: any[] }>(`/subscriptions${query}`);
          const items = (res.items || []).map(normalizeSubscription);
          set({ subscriptions: items });
        } catch (err) {
          set({ subscriptions: [] });
        } finally {
          set({ loadingSubscriptions: false });
        }
      },

      loadSuggestions: async () => {
        if (!get().user) return;
        set({ loadingSuggestions: true });
        try {
          const res = await api.get<{ items: any[] }>("/suggestions");
          const items = (res.items || []).map(normalizeSuggestion);
          set({ suggestions: items });
        } catch (err) {
          set({ suggestions: [] });
        } finally {
          set({ loadingSuggestions: false });
        }
      },

      login: async (email, password) => {
        const res = await api.post<{ user: any }>("/auth/login", { email, password });
        set({ user: normalizeUser(res.user), subscriptions: [], userFetched: true });
        await get().loadSubscriptions();
      },

      register: async (name, email, password) => {
        const res = await api.post<{ user: any }>("/auth/register", { name, email, password });
        set({ user: normalizeUser(res.user), subscriptions: [], userFetched: true });
        await get().loadSubscriptions();
      },

      logout: () => {
        set({ user: null, subscriptions: [], userFetched: true });
      },

      updateSubscriptionStatus: async (id, status) => {
        await api.patch(`/subscriptions/${id}`, { status });
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) =>
            sub.id === id ? { ...sub, status } : sub,
          ),
        }));
      },

      removeSubscription: async (id) => {
        await api.delete(`/subscriptions/${id}`);
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? { ...sub, isDeleted: true } : sub)),
        }));
      },

      deleteSubscription: async (id) => {
        try {
          await api.delete(`/subscriptions/${id}`);
          set((state) => ({
            subscriptions: state.subscriptions.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)),
          }));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to delete subscription", err);
          throw err;
        }
      },

      restoreSubscription: async (id: string) => {
        await api.post(`/subscriptions/${id}/restore`);
        set((state) => ({
          subscriptions: state.subscriptions.map((s) => (s.id === id ? { ...s, isDeleted: false } : s)),
        }));
      },

      connectGmail: async () => {
        const res = await api.get<{ url: string }>("/gmail/auth-url");
        if (res.url) {
          window.location.href = res.url;
        }
      },

      scanGmail: async (mode = "incremental") => {
        set({ isScanningGmail: true, scanProgress: 0 });
        let progress = 0;
        const timer = setInterval(() => {
          progress = Math.min(progress + 5, 95);
          set({ scanProgress: progress });
        }, 400);
        try {
          await api.post("/scan/gmail", { mode });
          set({ scanProgress: 100 });
          await get().loadSuggestions();
          await get().loadSubscriptions(true);
        } finally {
          clearInterval(timer);
          setTimeout(() => {
            set({ isScanningGmail: false, scanProgress: 0 });
          }, 600);
        }
      },

      startCheckout: async (plan) => {
        const res = await api.post<{ url: string }>("/billing/create-checkout-session", { plan });
        if (res.url) {
          window.location.href = res.url;
        }
      },

      acceptSuggestion: async (id) => {
        const res = await api.post<{ subscription: any }>(`/suggestions/${id}/accept`);
        if (res.subscription) {
          const normalized = normalizeSubscription(res.subscription);
          set((state) => ({
            suggestions: state.suggestions.filter((s) => s.id !== id),
            subscriptions: [normalized, ...state.subscriptions],
          }));
        }
      },

      ignoreSuggestion: async (id) => {
        await api.post(`/suggestions/${id}/ignore`);
        set((state) => ({
          suggestions: state.suggestions.filter((s) => s.id !== id),
        }));
      },
    }),
    {
      name: "subkiller-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);

setUnauthorizedHandler(() => {
  useAppStore.setState({ user: null, subscriptions: [], userFetched: true });
});
