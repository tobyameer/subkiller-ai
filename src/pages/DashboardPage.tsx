import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CreditCard, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { StatCard } from "../components/StatCard";
import { SpendingPie } from "../components/charts/SpendingPie";
import { Button } from "../components/ui/button";
import { SubscriptionStatusBadge } from "../components/SubscriptionStatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { useAppStore } from "../store/useAppStore";
import { formatCurrency, formatDate, capitalize } from "../lib/utils";
import { Subscription } from "../types";

export default function DashboardPage() {
  const user = useAppStore((state) => state.user);
  const subscriptions = useAppStore((state) => state.subscriptions);
  const loadSubscriptions = useAppStore((state) => state.loadSubscriptions);
  const monthlySpend = useAppStore((state) => state.monthlySpend());
  const lifetimeSpend = useAppStore((state) => state.lifetimeSpend());
  const loadUser = useAppStore((state) => state.loadUser);
  const connectGmail = useAppStore((state) => state.connectGmail);
  const scanGmail = useAppStore((state) => state.scanGmail);
  const updateStatus = useAppStore((state) => state.updateSubscriptionStatus);

  const [selected, setSelected] = useState<Subscription | null>(null);

  useEffect(() => {
    loadUser();
    loadSubscriptions();
  }, [loadUser, loadSubscriptions]);

  const recent = useMemo(() => {
    const getSortValue = (sub: Subscription) => {
      if (sub.nextRenewal) return new Date(sub.nextRenewal).getTime();
      return new Date(sub.lastChargeAt).getTime();
    };
    return [...subscriptions].sort((a, b) => getSortValue(b) - getSortValue(a));
  }, [subscriptions]);

  const renderRenewal = (sub: Subscription) => {
    if (!sub.nextRenewal) return sub.billingCycle === "one_time" ? "One-time" : "—";
    return formatDate(sub.nextRenewal);
  };

  const formatCycle = (cycle: string) => capitalize(cycle.replace("_", " "));

  const summary = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const yearlySpend = monthlySpend * 12;
    return {
      monthlySpend,
      yearlySpend,
      activeCount: activeSubs.length,
      cancelSoon: subscriptions.filter((s) => s.status === "past_due" || s.status === "on_hold").length,
    };
  }, [subscriptions, monthlySpend]);

  const computeNext = (sub: Subscription) => {
    if (sub.nextRenewal) return formatDate(sub.nextRenewal);
    if (!sub.lastChargeAt) return "—";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-400">Welcome back,</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-semibold text-slate-50">{user?.name ?? "SubKiller user"}</h1>
          <div className="flex gap-3">
            {!user?.gmailConnected ? (
              <Button variant="secondary" className="gap-2" onClick={connectGmail}>
                <RefreshCcw className="h-4 w-4" />
                Connect Gmail
              </Button>
            ) : (
              <Button className="gap-2" onClick={scanGmail}>
                <Sparkles className="h-4 w-4" />
                Scan Gmail
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly subscription spend"
          value={formatCurrency(summary.monthlySpend)}
          icon={<CreditCard className="h-5 w-5" />}
          accent="linear-gradient(90deg, #38bdf8, #14b8a6)"
        />
        <StatCard
          label="Total yearly (est.)"
          value={formatCurrency(summary.yearlySpend)}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="linear-gradient(90deg, #a78bfa, #38bdf8)"
        />
        <StatCard
          label="Active Subscriptions"
          value={String(summary.activeCount)}
          icon={<Sparkles className="h-5 w-5" />}
          accent="linear-gradient(90deg, #f472b6, #a855f7)"
        />
        <StatCard
          label="Lifetime spent"
          value={formatCurrency(lifetimeSpend)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="linear-gradient(90deg, #f59e0b, #f97316)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-slate-100">Recent subscriptions</CardTitle>
            <p className="text-sm text-slate-400">Latest charges and renewal dates.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400">
                  <th className="pb-3 pr-4">Service</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4">Monthly</th>
                  <th className="pb-3 pr-4">Cycle</th>
                  <th className="pb-3 pr-4">Next Renewal</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recent.slice(0, 6).map((sub) => (
                  <tr key={sub.id} className="text-slate-200">
                    <td className="py-3 pr-4 font-medium">{sub.service}</td>
                    <td className="py-3 pr-4 text-slate-400">{sub.category}</td>
                    <td className="py-3 pr-4">{formatCurrency(sub.estimatedMonthlySpend || sub.monthlyAmount)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatCycle(sub.billingCycle)}</td>
                    <td className="py-3 pr-4 text-slate-400">{computeNext(sub)}</td>
                    <td className="py-3 pr-4">
                      <SubscriptionStatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-200"
                          onClick={() => setSelected(sub)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(sub.id, "canceled")}
                        >
                          Mark to cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100">Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySpend > 0 ? (
              <SpendingPie subscriptions={subscriptions.filter((s) => s.status === "active" || s.status === "trial")} />
            ) : (
              <p className="text-sm text-slate-400">No active spend yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          {selected ? (
            <div className="space-y-4">
              <DialogTitle className="text-xl text-slate-50">{selected.service}</DialogTitle>
              <DialogDescription className="text-slate-300">
                {selected.category} • {formatCycle(selected.billingCycle)} billing • {formatCurrency(selected.monthlyAmount)}
              </DialogDescription>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Next renewal" value={renderRenewal(selected)} />
                <Detail label="Last charge" value={formatDate(selected.lastChargeAt)} />
                <Detail label="Total charges" value={String(selected.totalCharges ?? 0)} />
                <Detail label="Total spent" value={formatCurrency(selected.totalAmount || 0)} />
                <Detail label="Status" value={capitalize(selected.status.replace("_", " "))} />
                <Detail label="Started" value={formatDate(selected.createdAt)} />
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => updateStatus(selected.id, "canceled")}>
                  Mark to cancel
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
