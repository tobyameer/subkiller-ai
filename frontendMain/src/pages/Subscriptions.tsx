import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUser } from "@/hooks/useAuth";
import { isPro } from "@/lib/utils";
import { Bot } from "lucide-react";
import {
  useSubscriptions,
  useDeleteSubscription,
  useRestoreSubscription,
  useScanGmail,
  useSubscriptionDetails,
  useCardTransactions,
} from "@/hooks/useSubscriptions";
import { useGmailStatus } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Sparkles,
  Trash2,
  RotateCcw,
  RefreshCw,
  Mail,
  CreditCard,
  Loader2,
} from "lucide-react";
import { ScanProgress } from "@/components/ScanProgress";
import { ReviewDrawer } from "@/components/ReviewDrawer";
import { ScanModeSelector } from "@/components/ScanModeSelector";
import {
  useStartScan,
  useScanStatus,
  useNextReviewItem,
  ScanMode,
} from "@/hooks/useGmailScan";

const formatCurrency = (value?: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    value ?? 0
  );
const formatDate = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

export default function Subscriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, error: userError } = useUser();
  const subsQuery = useSubscriptions(Boolean(user?.email));
  const deleteMutation = useDeleteSubscription();
  const restoreMutation = useRestoreSubscription();
  const scanMutation = useScanGmail();
  const startScanMutation = useStartScan();
  const qc = useQueryClient();
  const gmailStatus = useGmailStatus(Boolean(user?.email));
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailsQuery = useSubscriptionDetails(selectedId);
  const cardTxQuery = useCardTransactions(
    selectedId && user?.plaidLinked ? selectedId : null
  );
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
      navigate("/subscriptions", { replace: true });
    } else if (params.get("gmail") === "error") {
      const reason = params.get("reason");
      const errorMsg = reason 
        ? `Gmail connect failed: ${decodeURIComponent(reason)}`
        : "Gmail connect failed. Please try again.";
      toast.error(errorMsg);
      // Clean URL
      navigate("/subscriptions", { replace: true });
    }
  }, [location.search, navigate, qc]);

  const gmailConnected = gmailStatus.data?.connected ?? false;
  const plan = user?.plan || "free";
  const userIsPro = isPro(user);

  const connectGmail = async () => {
    try {
      const res = await api.get<{ url: string }>("/api/gmail/auth-url");
      if (!res?.url) throw new Error("Missing Gmail auth URL");
      window.location.href = res.url;
    } catch (err: any) {
      const message =
        err?.message ||
        err?.response?.data?.message ||
        "Failed to start Gmail connect";
      toast.error(message);
    }
  };

  const needsReconnect = gmailStatus.data?.needsReconnect ?? false;
  const isConnected = gmailStatus.data?.connected ?? false;
  const gmailEmail = gmailStatus.data?.gmailEmail;
  const ctaLabel = !isConnected
    ? "Connect Gmail"
    : needsReconnect
    ? "Reconnect Gmail"
    : "Scan Gmail";

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

  const filteredSubs = useMemo(() => {
    const list = subsQuery.data || [];

    // Debug logging
    if (list.length > 0) {
      // eslint-disable-next-line no-console
      console.log("[Subscriptions] Raw data from backend:", {
        totalCount: list.length,
        first3: list.slice(0, 3).map((s: any) => ({
          service: s.service,
          totalCharges: s.totalCharges,
          totalAmount: s.totalAmount,
          lastChargeAt: s.lastChargeAt,
          billingCycle: s.billingCycle,
          sourceConfidence: s.sourceConfidence,
        })),
      });
    } else {
      // eslint-disable-next-line no-console
      console.log("[Subscriptions] No subscriptions returned from backend");
    }

    const term = search.toLowerCase();
    const isDisplayableSubscription = (sub: any) => {
      // Backend now returns all valid subscriptions including $0 ones (trials, paused, etc.)
      // Only apply noisy merchant filtering here
      const name = (sub.service || "").toLowerCase();
      const noisy =
        /starbucks|mcdonald|burger|pizza|uber|lyft|doordash|instacart|airlines|delta|united|ryanair|wizz|hotel|chevron|shell|grocery|coffee|food/i;

      // Only apply strict filtering to noisy merchants
      if (noisy.test(name)) {
        const recurringEvidence =
          (sub.totalCharges || 0) >= 2 ||
          ["monthly", "yearly"].includes(sub.billingCycle) ||
          sub.sourceConfidence === "email+card";
        if (!recurringEvidence) {
          // eslint-disable-next-line no-console
          console.log(
            "[Subscriptions] Filtered out (noisy one-off):",
            sub.service,
            {
              totalCharges: sub.totalCharges,
              billingCycle: sub.billingCycle,
              sourceConfidence: sub.sourceConfidence,
            }
          );
          return false;
        }
      }

      // For all other subscriptions, show if they have charges and amount > 0
      return true;
    };
    const searchFiltered = list.filter((s) =>
      s.service.toLowerCase().includes(term)
    );
    const displayFiltered = searchFiltered.filter(isDisplayableSubscription);

    // eslint-disable-next-line no-console
    console.log("[Subscriptions] Filter results:", {
      afterSearch: searchFiltered.length,
      afterDisplayFilter: displayFiltered.length,
    });

    return displayFiltered;
  }, [subsQuery.data, search]);

  const activeSubs = filteredSubs.filter((s) => !s.deletedAt);
  const deletedSubs = filteredSubs.filter((s) => Boolean(s.deletedAt));
  const displayed = tab === "active" ? activeSubs : deletedSubs;

  const renderRow = (sub: any) => (
    <div
      key={sub.id}
      className="group bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:border-primary/30 transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground break-words">
              {sub.service}
            </h3>
            <StatusPill status={sub.status as any} />
            {sub.sourceConfidence === "email+card" && (
              <Badge variant="outline">Verified by card</Badge>
            )}
            {sub.sourceConfidence === "card_only" && (
              <Badge variant="outline">Card detected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Last charge: {formatDate(sub.lastChargeAt)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold text-primary">
              {formatCurrency(sub.totalAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Charges: {sub.totalCharges ?? 0}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedId(sub.id)}
              className="gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => toast.info("AI coming soon")}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
            {tab === "active" ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate(sub.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={() => restoreMutation.mutate(sub.id)}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const details = detailsQuery.data;
  const paidCharges = (details?.charges || []).filter(
    (c) => c.status !== "failed"
  );
  const failedCharges = (details?.charges || []).filter(
    (c) => c.status === "failed"
  );
  const detailTotal = paidCharges.reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isLoggedIn={Boolean(user)} userName={user?.email} />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 space-y-6">
          {/* Scan Progress */}
          {(currentScanId || scanStatus.data || scanStatus.isLoading) && (
            <div>
              <ScanProgress
                status={scanStatus.data || null}
                isLoading={scanStatus.isLoading}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Subscriptions</h1>
              <p className="text-sm text-muted-foreground">
                Track and manage your recurring spend.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                Back to dashboard
              </Button> */}
              {/* <Button
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => scanMutation.mutate("full")}
                disabled={scanMutation.isPending}
                >
                <RefreshCw className="w-4 h-4" /> Full rescan
                </Button> */}
              <Badge variant="outline" className="flex items-center gap-1">
                <Mail className="w-3 h-3" />{" "}
                {needsReconnect
                  ? "Reconnect needed"
                  : isConnected
                  ? (gmailEmail ? `Connected: ${gmailEmail}` : "Gmail connected")
                  : "Not connected"}
              </Badge>
              {userIsPro ? (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />{" "}
                  {user?.plaidLinked ? "Card connected" : "Card not connected"}
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigate("/pricing");
                    toast.info("Upgrade to Pro to add your card");
                  }}
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Add card
                </Button>
              )}
              {isConnected && !needsReconnect ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1"
                    onClick={handleStartScan}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Scan Gmail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      if (isScanning) return;
                      if (window.confirm("Disconnect Gmail?"))
                        disconnectMutation.mutate();
                    }}
                    disabled={disconnectMutation.isPending || isScanning}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1"
                  onClick={connectGmail}
                >
                  <Mail className="w-4 h-4" />
                  {ctaLabel}
                </Button>
              )}
            </div>
          </div>

          {!userIsPro && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    New: AI Copilot — ask questions about your subscriptions,
                    price hikes, and ways to save.
                  </p>
                </div>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => {
                    navigate("/pricing");
                    toast.info("Upgrade to Pro to unlock AI Copilot");
                  }}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Unlock AI Copilot
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="lg:w-64 space-y-3">
              <Input
                placeholder="Search services"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="text-sm text-muted-foreground">
                <p>Active: {activeSubs.length}</p>
                <p>Deleted: {deletedSubs.length}</p>
              </div>
              {!userIsPro && (
                <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/50">
                  Pro = unlimited scans + AI Copilot
                </div>
              )}
            </div>
            <div className="flex-1">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="deleted">Deleted</TabsTrigger>
                </TabsList>
                <TabsContent value="active">
                  <ScrollArea className="h-[65vh] pb-4 pr-3 space-y-3">
                    {subsQuery.isLoading && (
                      <p className="text-muted-foreground">Loading...</p>
                    )}
                    {!subsQuery.isLoading && activeSubs.length === 0 && (
                      <p className="text-muted-foreground">
                        No subscriptions yet.
                      </p>
                    )}
                    {activeSubs.map(renderRow)}
                    {!userIsPro && activeSubs.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border/60 text-sm text-muted-foreground">
                        <p>
                          <strong>Want fewer false positives?</strong> Pro adds
                          AI Copilot + card accuracy.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => navigate("/pricing")}
                        >
                          Upgrade to Pro
                        </Button>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="deleted">
                  <ScrollArea className="h-[65vh] pr-3 space-y-3">
                    {deletedSubs.length === 0 && (
                      <p className="text-muted-foreground">
                        No deleted subscriptions.
                      </p>
                    )}
                    {deletedSubs.map((s) => renderRow(s))}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => setSelectedId(open ? selectedId : null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {details?.subscription.service || "Subscription"}
            </DialogTitle>
          </DialogHeader>
          {detailsQuery.isLoading && (
            <p className="text-muted-foreground">Loading details...</p>
          )}
          {details && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total paid</p>
                  <p className="font-semibold">{formatCurrency(detailTotal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last charge</p>
                  <p className="font-semibold">
                    {formatDate(details.subscription.lastChargeAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Next renewal</p>
                  <p className="font-semibold">
                    {formatDate(details.subscription.nextRenewal)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Charges</p>
                  <p className="font-semibold">{paidCharges.length}</p>
                </div>
              </div>

              <Tabs defaultValue="receipts">
                <TabsList>
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="card" disabled={!user?.plaidLinked}>
                    Card transactions
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="receipts">
                  <div className=" max-h-72 overflow-y-auto space-y-2">
                    {details.charges.map((charge) => (
                      <div
                        key={charge.id}
                        className="flex items-center justify-between gap-3 border border-border/60 rounded-lg px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {charge.subject || "Receipt"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(charge.chargedAt)} •{" "}
                            {charge.status || "paid"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(charge.amount, charge.currency)}
                          </p>
                          {charge.gmailMessageId && (
                            <a
                              href={`https://mail.google.com/mail/u/0/#all/${charge.gmailMessageId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary"
                            >
                              View email
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {failedCharges.length > 0 && (
                      <p className="text-xs text-yellow-400">
                        Contains failed/declined receipts that are excluded from
                        totals.
                      </p>
                    )}
                    {details.charges.length === 0 && (
                      <p className="text-muted-foreground">No receipts yet.</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="card">
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {cardTxQuery.isLoading && (
                      <p className="text-muted-foreground">Loading...</p>
                    )}
                    {(cardTxQuery.data || []).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {tx.merchantName || details.subscription.service}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tx.date)}{" "}
                            {tx.pending ? "• Pending" : ""}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                      </div>
                    ))}
                    {cardTxQuery.data && cardTxQuery.data.length === 0 && (
                      <p className="text-muted-foreground">
                        No matched card transactions yet.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            <ScanModeSelector
              value={scanMode}
              onChange={setScanMode}
              disabled={startScanMutation.isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmScan}
              disabled={startScanMutation.isPending}
            >
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
