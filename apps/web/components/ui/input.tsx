import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      className={cn(
        "flex h-12 w-full rounded-2xl border border-input bg-white/78 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = "Input";
