import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
