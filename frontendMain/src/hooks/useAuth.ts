import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User } from "@/types";

const normalizeUser = (raw: any): User => ({
  id: raw.id || raw._id || "",
  email: raw.email,
  name: raw.name || raw.fullName,
  firstName: raw.firstName,
  lastName: raw.lastName,
  gender: raw.gender,
  dob: raw.dob,
  country: raw.country,
  marketingOptIn: raw.marketingOptIn,
  plan: raw.plan,
  gmailConnected: Boolean(
    (raw.gmailConnected && (raw.gmailTokens?.refresh || raw.gmailTokens?.access)) ||
      raw.gmailTokens?.refresh
  ),
  gmailEmail: raw.gmailEmail ?? raw.email,
  plaidLinked: raw.plaidLinked ?? false,
});

const fetchUser = async (): Promise<User> => {
  const res = await api.get<{ user: any } | User>("/api/auth/me");
  const raw: any = (res as any).user ?? res;
  return normalizeUser(raw);
};

export function useUser() {
  return useQuery({ 
    queryKey: ["me"], 
    queryFn: fetchUser, 
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export interface GmailStatus {
  connected: boolean;
  needsReconnect: boolean;
  reason?: string;
  gmailEmail?: string;
}

const fetchGmailStatus = async (): Promise<GmailStatus> => api.get("/api/gmail/status");

export function useGmailStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["gmail-status"],
    enabled,
    queryFn: fetchGmailStatus,
    retry: false,
  });
}

export function useAuthMutations() {
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: (payload: { email: string; password: string }) => api.post("/api/auth/login", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const register = useMutation({
    mutationFn: (payload: any) => api.post("/api/auth/register", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const logout = useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const upgradePlan = useMutation({
    mutationFn: () => api.post("/api/billing/upgrade"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const updateProfile = useMutation({
    mutationFn: (payload: Partial<User>) => api.patch("/api/users/me", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return { login, register, logout, updateProfile, upgradePlan };
}
