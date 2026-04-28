import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-36 w-full rounded-[24px] border border-input bg-white/78 px-4 py-3 text-sm leading-6 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
