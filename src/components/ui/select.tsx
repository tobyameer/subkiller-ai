import * as React from "react";
import { cn } from "../../lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-inner shadow-slate-950/40 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";
