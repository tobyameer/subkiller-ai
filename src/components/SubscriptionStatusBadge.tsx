import { Badge } from "./ui/badge";
import { SubscriptionStatus } from "../types";

const statusMap: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "default" }> = {
  active: { label: "Active", variant: "success" },
  trial: { label: "Trial", variant: "default" },
  past_due: { label: "Past Due", variant: "warning" },
  on_hold: { label: "On Hold", variant: "warning" },
  canceled: { label: "Canceled", variant: "muted" },
  expired: { label: "Expired", variant: "muted" },
  unknown: { label: "Unknown", variant: "default" },
};
export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const config = statusMap[status] || statusMap.unknown;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
