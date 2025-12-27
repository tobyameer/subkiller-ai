import { cn } from "@/lib/utils";

type StatusType = 
  | "active" 
  | "trial" 
  | "canceled" 
  | "cancel_soon"
  | "paused" 
  | "payment_failed"
  | "on_hold" 
  | "connected" 
  | "disconnected";

interface StatusPillProps {
  status: StatusType | string | undefined | null;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-primary/20 text-primary border-primary/30",
  },
  trial: {
    label: "Trial",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  canceled: {
    label: "Canceled",
    className: "bg-muted text-muted-foreground border-muted",
  },
  cancel_soon: {
    label: "Canceling soon",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  paused: {
    label: "Paused",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  payment_failed: {
    label: "Payment failed",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  on_hold: {
    label: "On hold",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  connected: {
    label: "Connected",
    className: "bg-primary/20 text-primary border-primary/30",
  },
  disconnected: {
    label: "Not connected",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
};

export function StatusPill({ status, className }: StatusPillProps) {
  // Fallback to 'active' if status is undefined/null/invalid
  const validStatus = (status && statusConfig[status]) ? status : "active";
  const config = statusConfig[validStatus] || statusConfig.active;
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-2" />
      {config.label}
    </span>
  );
}
