"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,#c95e1d_0%,#a74a14_100%)] text-primary-foreground shadow-[0_18px_40px_-22px_rgba(160,73,20,0.88)] hover:-translate-y-0.5 hover:brightness-[1.03]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[#efe3d5]",
        outline:
          "border border-[rgba(121,79,40,0.18)] bg-white/72 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
));

Button.displayName = "Button";

export { Button, buttonVariants };
