import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leftIcon ? (
          <span className="absolute left-3 text-slate-500" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-inner shadow-slate-950/40 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder:text-slate-500",
            leftIcon && "pl-10",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
