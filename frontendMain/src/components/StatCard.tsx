import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  variant?: "default" | "accent" | "glow";
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  variant = "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative p-6 rounded-xl border border-border/50 bg-card transition-all duration-300 hover:border-primary/30 group overflow-hidden",
        variant === "glow" && "shadow-[0_0_30px_hsl(152_100%_50%/0.1)]",
        variant === "accent" && "border-primary/20",
        className
      )}
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
        
        <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
        
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        
        {trend && (
          <div className="flex items-center gap-1 mt-3">
            <span
              className={cn(
                "text-sm font-medium",
                trend.value >= 0 ? "text-primary" : "text-destructive"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
