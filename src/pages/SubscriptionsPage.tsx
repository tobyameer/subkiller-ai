import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Filter,
  Search,
  Pause,
  Ban,
  Trash2,
  Eye,
  Info,
  Loader2,
  Mail,
  RotateCcw,
  Undo2,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { SubscriptionStatusBadge } from "../components/SubscriptionStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { useAppStore } from "../store/useAppStore";
import { formatCurrency, formatDate, capitalize } from "../lib/utils";
import { BillingCycle, Subscription, SubscriptionStatus } from "../types";

type Filters = {
  billingCycle?: BillingCycle;
  status?: SubscriptionStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
};

export default function SubscriptionsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [tab, setTab] = useState<"active" | "deleted">("active");
  const navigate = useNavigate();
  const subscriptions = useAppStore((state) => state.subscriptions);
  const loadSubscriptions = useAppStore((state) => state.loadSubscriptions);
  const updateStatus = useAppStore((state) => state.updateSubscriptionStatus);
  const deleteSubscription = useAppStore((state) => state.deleteSubscription);
  const restoreSubscription = useAppStore((state) => state.restoreSubscription);
  const scanGmail = useAppStore((state) => state.scanGmail);
  const user = useAppStore((state) => state.user);
  const suggestions = useAppStore((state) => state.suggestions);
  const loadSuggestions = useAppStore((state) => state.loadSuggestions);
  const isScanningGmail = useAppStore((state) => state.isScanningGmail);
  const scanProgress = useAppStore((state) => state.scanProgress);
  const loadingSubscriptions = useAppStore(
    (state) => state.loadingSubscriptions
  );
  const isFree = user?.subscriptionPlan === "free";
  const monthlySpend = useAppStore((state) => state.monthlySpend());
  const lifetimeSpend = useAppStore((state) => state.lifetimeSpend());

  useEffect(() => {
    loadSubscriptions(true);
    loadSuggestions();
  }, [loadSubscriptions, loadSuggestions]);

  const filtered = useMemo(() => {
    const lowered = search.toLowerCase();
    return subscriptions.filter((sub) => {
      if (tab === "active" && sub.isDeleted) return false;
      if (tab === "deleted" && !sub.isDeleted) return false;
      if (tab === "active" && !showCanceled && sub.status === "canceled")
        return false;
      if (
        sub.estimatedMonthlySpend !== undefined &&
        sub.estimatedMonthlySpend <= 0
      )
        return false;
      const fromDate = filters.fromDate ? new Date(filters.fromDate) : null;
      const toDate = filters.toDate ? new Date(filters.toDate) : null;
      const lastCharge = sub.lastChargeAt ? new Date(sub.lastChargeAt) : null;
      const matchesBilling = filters.billingCycle
        ? sub.billingCycle === filters.billingCycle
        : true;
      const matchesStatus = filters.status
        ? sub.status === filters.status
        : true;
      const matchesSearch = lowered
        ? sub.service.toLowerCase().includes(lowered) ||
          (sub.providerName
            ? sub.providerName.toLowerCase().includes(lowered)
            : false)
        : true;
      const matchesFrom =
        fromDate && lastCharge ? lastCharge >= fromDate : true;
      const matchesTo = toDate && lastCharge ? lastCharge <= toDate : true;
      return (
        matchesBilling &&
        matchesStatus &&
        matchesSearch &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [filters, subscriptions, showCanceled, search, tab]);

  const getManageUrl = (sub: Subscription) => {
    if (sub.manageUrl) return sub.manageUrl;
    const provider = sub.providerName || sub.service;
    if (!provider) return null;
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${provider} manage subscription`
    )}`;
  };

  const renderRenewal = (sub: Subscription) => {
    if (sub.nextRenewal) return formatDate(sub.nextRenewal);
    if (!sub.lastChargeAt)
      return sub.billingCycle === "one_time" ? "One-time" : "—";
    const last = new Date(sub.lastChargeAt);
    const next = new Date(last);
    switch (sub.billingCycle) {
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        return formatDate(next.toISOString());
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        return formatDate(next.toISOString());
      case "weekly":
        next.setDate(next.getDate() + 7);
        return formatDate(next.toISOString());
      case "one_time":
        return "One-time";
      default:
        return "—";
    }
  };

  const formatCycle = (cycle: string) => capitalize(cycle.replace("_", " "));

  const totalMonthlySpend = useMemo(() => monthlySpend, [monthlySpend]);
  const manageUrlForSelected = selected ? getManageUrl(selected) : null;
  const isSingleChargeRecurring =
    selected &&
    (selected.billingCycle === "monthly" ||
      selected.billingCycle === "weekly" ||
      selected.billingCycle === "yearly") &&
    (selected.totalCharges ?? 1) <= 1 &&
    !selected.autoCanceled;

  return (
    <div className="space-y-6">
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-slate-100">
          We found {suggestions.length} new subscription suggestions. Review
          them on the{" "}
          <a
            href="/suggestions"
            className="font-semibold text-sky-300 underline"
          >
            Suggestions page
          </a>
          .
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Manage every recurring cost</p>
          <h1 className="text-3xl font-semibold text-slate-50">
            Subscriptions
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
            You’re spending{" "}
            <span className="font-semibold text-slate-50">
              {formatCurrency(totalMonthlySpend)}
            </span>{" "}
            / month · Lifetime:{" "}
            <span className="font-semibold text-slate-50">
              {formatCurrency(lifetimeSpend)}
            </span>
          </div>
          <Button
            className="gap-2"
            onClick={() => scanGmail("incremental")}
            disabled={isScanningGmail}
          >
            {isScanningGmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isScanningGmail ? "Scanning..." : "Scan Gmail"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const proceed = window.confirm(
                "Full rescan will reprocess recent billing emails to rebuild your subscriptions. Continue?"
              );
              if (!proceed) return;
              scanGmail("full");
            }}
            disabled={isScanningGmail}
            title="Rescan recent billing emails (last months)"
          >
            <RotateCcw className="h-4 w-4" />
            Full rescan
          </Button>
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => loadSubscriptions(true)}
            disabled={loadingSubscriptions}
          >
            {loadingSubscriptions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-200 md:grid-cols-3">
        <div>
          Active / Trial:{" "}
          <span className="font-semibold text-slate-50">
            {
              subscriptions.filter(
                (s) =>
                  !s.isDeleted &&
                  (s.status === "active" || s.status === "trial")
              ).length
            }
          </span>
        </div>
        <div>
          Past due / On hold:{" "}
          <span className="font-semibold text-amber-300">
            {
              subscriptions.filter(
                (s) =>
                  !s.isDeleted &&
                  (s.status === "past_due" || s.status === "on_hold")
              ).length
            }
          </span>
        </div>
        <div>
          Lifetime spent:{" "}
          <span className="font-semibold text-slate-50">
            {formatCurrency(lifetimeSpend)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={tab === "active" ? "secondary" : "ghost"}
          onClick={() => setTab("active")}
        >
          Active
        </Button>
        <Button
          variant={tab === "deleted" ? "secondary" : "ghost"}
          onClick={() => setTab("deleted")}
        >
          Recently Deleted
        </Button>
        {tab === "deleted" && (
          <p className="text-sm text-slate-400">
            Restoring moves subscriptions back into tracking without canceling
            them at the provider.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Search service..."
              className="md:col-span-2"
              leftIcon={<Search className="h-4 w-4 text-slate-500" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="From date"
                value={filters.fromDate ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, fromDate: e.target.value || undefined }))
                }
              />
              <Input
                type="date"
                placeholder="To date"
                value={filters.toDate ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, toDate: e.target.value || undefined }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={filters.billingCycle ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    billingCycle:
                      (e.target.value as Filters["billingCycle"]) || undefined,
                  }))
                }
              >
                <option value="">Billing</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="one_time">One-time</option>
                <option value="unknown">Unknown</option>
              </Select>
              <Select
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    status: (e.target.value as Filters["status"]) || undefined,
                  }))
                }
              >
                <option value="">Status</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="on_hold">On Hold</option>
                <option value="trial">Trial</option>
                <option value="canceled">Canceled</option>
                <option value="expired">Expired</option>
                <option value="unknown">Unknown</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showCanceled}
                onChange={(e) => setShowCanceled(e.target.checked)}
              />
              Show canceled
            </label>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400">
                <th className="pb-3 pr-4">Service</th>
                <th className="pb-3 pr-4">Est. Monthly</th>
                <th className="pb-3 pr-4">Cycle</th>
                <th className="pb-3 pr-4">Last Charge</th>
                <th className="pb-3 pr-4">Next Renewal</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Totals</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((sub) => {
                const manageUrl = getManageUrl(sub);
                return (
                  <tr
                    key={sub.id}
                    className="text-slate-200 transition hover:bg-slate-900/50"
                  >
                    <td className="py-3 pr-4 font-medium">{sub.service}</td>
                    <td className="py-3 pr-4">
                      {formatCurrency(
                        sub.estimatedMonthlySpend || sub.monthlyAmount
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {formatCycle(sub.billingCycle)}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {formatDate(sub.lastChargeAt)}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {renderRenewal(sub)}
                    </td>
                    <td className="py-3 pr-4">
                      <SubscriptionStatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-400 text-sm">
                      <div>Total charges: {sub.totalCharges ?? 0}</div>
                      <div>
                        Total spent: {formatCurrency(sub.totalAmount || 0)}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="View details"
                          onClick={() => setSelected(sub)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Ask AI about this subscription"
                          onClick={() =>
                            navigate(
                              `/ai?service=${encodeURIComponent(
                                sub.service
                              )}&subscriptionId=${encodeURIComponent(sub.id)}`,
                            )
                          }
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Ask AI
                        </Button>
                        {tab === "deleted" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label="Restore subscription"
                            onClick={async () => {
                              await restoreSubscription(sub.id);
                              setTab("active");
                            }}
                            disabled={loadingSubscriptions || isScanningGmail}
                          >
                            <Undo2 className="mr-1 h-4 w-4" />
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Open provider"
                              asChild={!!manageUrl}
                              disabled={!manageUrl}
                              title="Manage this subscription on the provider site"
                            >
                              {manageUrl ? (
                                <a
                                  href={manageUrl || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="mr-1 h-4 w-4" />
                                  Open provider
                                </a>
                              ) : (
                                <>
                                  <ExternalLink className="mr-1 h-4 w-4" />
                                  Open provider
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Pause billing"
                              title={
                                isFree
                                  ? "Upgrade to Pro to modify billing"
                                  : "Pause billing"
                              }
                              disabled={isFree}
                              onClick={() => updateStatus(sub.id, "on_hold")}
                            >
                              <Pause className="mr-1 h-4 w-4" />
                              Pause
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Mark as canceled"
                              title={
                                isFree
                                  ? "Upgrade to Pro to modify billing"
                                  : "Mark as canceled"
                              }
                              disabled={isFree}
                              onClick={() => updateStatus(sub.id, "canceled")}
                            >
                              <Ban className="mr-1 h-4 w-4" />
                              Cancel
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete subscription"
                              title={
                                isFree
                                  ? "Upgrade to Pro to delete subscriptions"
                                  : "Delete subscription"
                              }
                              disabled={isFree}
                              onClick={() => setDeleteTarget(sub)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-slate-400">
              No subscriptions match these filters.
            </div>
          )}
        </CardContent>
      </Card>

      {isScanningGmail && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 px-4 py-4 text-slate-100 shadow-xl">
            <div className="mb-2 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
              <p className="font-semibold">
                Scanning Gmail for billing emails…
              </p>
            </div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
              <span>Building your subscriptions</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          {selected ? (
            <div className="space-y-4">
              <DialogTitle className="text-xl text-slate-50">
                {selected.service}
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                {selected.category} • {formatCycle(selected.billingCycle)} •{" "}
                {formatCurrency(
                  selected.estimatedMonthlySpend || selected.monthlyAmount
                )}
              </DialogDescription>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="First charge"
                  value={formatDate(selected.firstChargeAt)}
                />
                <Detail
                  label="Last charge"
                  value={formatDate(selected.lastChargeAt)}
                />
                <Detail label="Next renewal" value={renderRenewal(selected)} />
                <Detail
                  label="Total charges"
                  value={`${selected.totalCharges ?? 0}`}
                />
                <Detail
                  label="Total spent"
                  value={formatCurrency(selected.totalAmount || 0)}
                />
                <Detail
                  label="Status"
                  value={capitalize(selected.status.replace("_", " "))}
                />
                <Detail
                  label="Started"
                  value={formatDate(selected.createdAt)}
                />
              </div>
              <div className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-3 text-sm text-slate-200">
                <p className="font-semibold text-slate-100">
                  Manage at the provider
                </p>
                <p className="text-slate-300">
                  SubKiller tracks and analyzes your spend. To cancel or update
                  billing, open the provider&apos;s account page. We cannot
                  cancel on your behalf.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild={!!manageUrlForSelected}
                    disabled={!manageUrlForSelected}
                  >
                    {manageUrlForSelected ? (
                      <a
                        href={manageUrlForSelected || "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open provider
                      </a>
                    ) : (
                      <>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open provider
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => updateStatus(selected.id, "active")}
                  aria-label="Set status active"
                >
                  Mark as Active
                </Button>
                <Button
                  onClick={() => updateStatus(selected.id, "canceled")}
                  aria-label="Mark as canceled"
                  disabled={isFree}
                  title={isFree ? "Upgrade to Pro to modify subscriptions" : ""}
                >
                  Mark as Canceled
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateStatus(selected.id, "on_hold")}
                  aria-label="Pause billing"
                  disabled={isFree}
                  title={isFree ? "Upgrade to Pro to modify subscriptions" : ""}
                >
                  Pause Billing
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(selected)}
                  aria-label="Delete subscription"
                  disabled={isFree}
                  title={isFree ? "Upgrade to Pro to delete subscriptions" : ""}
                >
                  Delete Subscription
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogTitle className="text-xl text-slate-50">
            Remove this subscription from SubKiller?
          </DialogTitle>
          <DialogDescription className="space-y-3 text-slate-300">
            <p>
              This will remove this subscription&apos;s history and tracking
              from SubKiller.
            </p>
            <p>
              It does{" "}
              <span className="font-semibold text-emerald-200">NOT</span> cancel
              the subscription with the provider (Spotify, Netflix, etc.).
            </p>
            <p>
              We will also remove any card details stored in this app for this
              subscription.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
              <Info className="h-4 w-4" />
              <span>
                Remember to cancel directly with the provider if you
                haven&apos;t already.
              </span>
            </div>
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteSubscription(deleteTarget.id);
                  setTab("deleted");
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error("Failed to delete subscription", err);
                } finally {
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
