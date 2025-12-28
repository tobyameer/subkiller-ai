import { useEffect, useMemo, useCallback, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { SpendChart } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, RefreshCw, CreditCard, Radar, Mail, Bot } from "lucide-react";
import { useUser, useGmailStatus } from "@/hooks/useAuth";
import { useSubscriptions, useScanGmail } from "@/hooks/useSubscriptions";
import { useDashboardSummary, useRecentCharges, RecentCharge } from "@/hooks/useDashboard";
import { formatCurrency } from "@/lib/format";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isPro } from "@/lib/utils";
import { ScanProgress } from "@/components/ScanProgress";
import { ReviewDrawer } from "@/components/ReviewDrawer";
import { ScanModeSelector } from "@/components/ScanModeSelector";
import {
  useStartScan,
  useScanStatus,
  useNextReviewItem,
  ScanMode,
} from "@/hooks/useGmailScan";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, error: userError } = useUser();
  const userIsPro = isPro(user);
  const gmailStatus = useGmailStatus(Boolean(user?.email));
  const subsQuery = useSubscriptions(Boolean(user?.email));
  const summaryQuery = useDashboardSummary(Boolean(user?.email));
  const recentChargesQuery = useRecentCharges(Boolean(user?.email));
  const scanMutation = useScanGmail();
  const startScanMutation = useStartScan();
  const qc = useQueryClient();
  const displayName = (user?.email || "").split("@")[0] || "there";
  const isScanning = scanMutation.isPending || startScanMutation.isPending;
  const [scanMode, setScanMode] = useState<ScanMode>("quick");
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const scanStatus = useScanStatus(currentScanId);
  const nextReviewItem = useNextReviewItem();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const disconnectMutation = useMutation({
    mutationFn: () => api.post("/api/gmail/disconnect"),
    onSuccess: () => {
      toast.success("Gmail disconnected");
      qc.invalidateQueries({ queryKey: ["gmail-status"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to disconnect"),
  });

  useEffect(() => {
    if (userError) navigate("/login");
  }, [userError, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("gmail") === "connected") {
      const email = params.get("email");
      if (email) {
        toast.success(`Gmail connected: ${email}`);
      } else {
        toast.success("Gmail connected successfully");
      }
      // Invalidate queries to refresh status
      qc.invalidateQueries({ queryKey: ["gmail-status"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      // Clean URL
      navigate("/dashboard", { replace: true });
    } else if (params.get("gmail") === "error") {
      const reason = params.get("reason");
      const errorMsg = reason 
        ? `Gmail connect failed: ${decodeURIComponent(reason)}`
        : "Gmail connect failed. Please try again.";
      toast.error(errorMsg);
      // Clean URL
      navigate("/dashboard", { replace: true });
    }
  }, [location.search, navigate, qc]);

  const connectGmail = useCallback(async () => {
    try {
      const res = await api.get<{ url: string }>("/api/gmail/auth-url");
      if (!res?.url) throw new Error("Missing Gmail auth URL");
      window.location.href = res.url;
    } catch (err: any) {
      const message =
        err?.message || err?.response?.data?.message || "Failed to start Gmail connect";
      toast.error(message);
    }
  }, []);

  const gmailConnected = gmailStatus.data?.connected ?? false;
  const needsReconnect = gmailStatus.data?.needsReconnect ?? false;
  const gmailEmail = gmailStatus.data?.gmailEmail;
  const gmailBadge = needsReconnect 
    ? "Reconnect needed" 
    : gmailConnected 
    ? (gmailEmail ? `Connected: ${gmailEmail}` : "Gmail connected")
    : "Not connected";
  const gmailCtaLabel = !gmailConnected ? "Connect Gmail" : needsReconnect ? "Reconnect Gmail" : "Scan Gmail";

  const activeSubs = useMemo(() => (subsQuery.data || []).filter((s) => !s.deletedAt), [subsQuery.data]);

  const lifetime = summaryQuery.data?.lifetimeTotal ?? 0;
  const monthly = summaryQuery.data?.monthlyRecurring ?? 0;
  const activeCount = summaryQuery.data?.activeCount ?? activeSubs.filter((s) => s.status === "active").length;
  const recentCharges: RecentCharge[] = recentChargesQuery.data || [];
  const chartData = useMemo(() => {
    const months = summaryQuery.data?.last6Months;
    if (months && months.length) {
      return months.map((m) => ({
        month: m.label,
        amount: Number(m.total ?? 0),
      }));
    }
    return [];
  }, [summaryQuery.data?.last6Months]);

  // Handle scan start
  const handleStartScan = useCallback(async () => {
    try {
      setShowModeDialog(true);
    } catch (error: any) {
      toast.error(error?.message || "Failed to start scan");
    }
  }, []);

  const handleConfirmScan = useCallback(async () => {
    try {
      const result = await startScanMutation.mutateAsync(scanMode);
      setCurrentScanId(result.scanId);
      setShowModeDialog(false);
      toast.success("Scan started");
    } catch (error: any) {
      toast.error(error?.message || "Failed to start scan");
    }
  }, [scanMode, startScanMutation]);

  // Auto-open review drawer when items are pending
  useEffect(() => {
    if (nextReviewItem.data && !reviewDrawerOpen) {
      setReviewDrawerOpen(true);
    }
  }, [nextReviewItem.data, reviewDrawerOpen]);

  // Handle review item resolved
  const handleReviewResolved = useCallback(() => {
    // Query will auto-refetch next item
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Scan Progress */}
          {(currentScanId || scanStatus.data || scanStatus.isLoading) && (
            <div className="mb-6">
              <ScanProgress status={scanStatus.data || null} isLoading={scanStatus.isLoading} />
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome back, {displayName}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Radar className="w-4 h-4 text-primary animate-pulse" />
                <span>AI Money Radar online</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {gmailConnected && !needsReconnect ? (
                <>
                  <StatusPill status="connected" />
                  <span className="text-sm text-muted-foreground">{user.gmailEmail}</span>
                  {!userIsPro && (
                    <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-secondary">
                      Pro = unlimited scans + AI Copilot
                    </span>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStartScan}
                    disabled={isScanning}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isScanning ? "Scanning..." : "Scan Gmail"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isScanning) return;
                      if (window.confirm("Disconnect Gmail?")) disconnectMutation.mutate();
                    }}
                    disabled={disconnectMutation.isPending || isScanning}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  <StatusPill status={needsReconnect ? "warning" : "disconnected"} />
                  <Button variant="hero" size="sm" onClick={connectGmail}>
                    <Mail className="w-4 h-4 mr-2" />
                    {gmailCtaLabel}
                  </Button>
                </>
              )}
              {!userIsPro && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigate("/pricing");
                    toast.info("Upgrade to Pro to add your card");
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Add card
                </Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <StatCard title="Lifetime spent tracked" value={formatCurrency(lifetime)} icon={DollarSign} variant="glow" />
            <StatCard title="Recurring per month" value={formatCurrency(monthly)} subtitle={`Across ${activeSubs.length} subs`} icon={RefreshCw} />
            <StatCard title="Active subscriptions" value={String(activeCount)} icon={CreditCard} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Spend last 6 months</h3>
                  <p className="text-sm text-muted-foreground">Total charges detected</p>
                </div>
              </div>
              <div className="h-64">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No charges yet.
                  </div>
                ) : (
                  <SpendChart data={chartData} type="bar" />
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">AI Copilot</h3>
                  <p className="text-sm text-muted-foreground">
                    {userIsPro ? "Get insights from your receipts" : "New: Ask questions about your subscriptions"}
                  </p>
                </div>
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {userIsPro
                  ? "Ask Copilot about your subscriptions, price hikes, and ways to save."
                  : "Ask questions about your subscriptions, price hikes, and ways to save."}
              </p>
              <Button
                variant={userIsPro ? "outline" : "hero"}
                className="w-full"
                onClick={() => {
                  if (userIsPro) {
                    navigate("/ai-copilot");
                  } else {
                    navigate("/pricing");
                    toast.info("Upgrade to Pro to unlock AI Copilot");
                  }
                }}
              >
                {userIsPro ? "Open AI Copilot" : "Unlock AI Copilot"}
              </Button>
            </div>
          </div>

          {!userIsPro && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-foreground mb-2">
                <strong>Want fewer false positives?</strong> Pro adds AI Copilot + card accuracy.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/pricing")}
              >
                Upgrade to Pro
              </Button>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/subscriptions">View all</Link>
              </Button>
            </div>
            {recentCharges.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No subscriptions detected yet. Connect Gmail and run a scan to see activity.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {recentCharges.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/70 border border-border/60">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center">
                      {item.service?.[0] || "S"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.service}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.status || "paid"} • {item.chargedAt ? new Date(item.chargedAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="ml-auto text-sm font-semibold text-foreground">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                ))}
                <Link
                  to="/subscriptions"
                  className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-primary transition"
                >
                  <Bot className="w-4 h-4" />
                  See full activity
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Scan Mode Dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Scan Mode</DialogTitle>
            <DialogDescription>
              Select how strict you want the review process to be
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScanModeSelector value={scanMode} onChange={setScanMode} disabled={startScanMutation.isPending} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmScan} disabled={startScanMutation.isPending}>
              {startScanMutation.isPending ? "Starting..." : "Start Scan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Drawer */}
      <ReviewDrawer
        item={nextReviewItem.data || null}
        open={reviewDrawerOpen}
        onOpenChange={setReviewDrawerOpen}
        onResolved={handleReviewResolved}
      />
    </div>
  );
}
