import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Pill-shaped, tech-retail style. The three neutral variants map to the fill
 * weights status uses (outline → tint → solid), so a badge can carry status
 * without borrowing a hue.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        /* Status fill weights */
        outline: "border-rule bg-copy text-ink-soft",
        tint: "border-rule bg-secondary text-ink",
        solid: "border-ink bg-ink text-paper",

        /* Urgency and meaning */
        default: "border-bench bg-bench text-white",
        bench: "border-bench/30 bg-bench-fill text-bench-ink",
        flag: "border-flag/40 bg-flag-fill text-flag-ink",
        stamp: "border-stamp/40 bg-stamp-fill text-stamp-ink",
        destructive: "border-stamp bg-stamp text-white",
        secondary: "border-rule bg-secondary text-ink",
        ghost: "border-transparent text-ink-soft",
        link: "border-transparent text-bench-ink underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

function Badge({
  className,
  variant = "outline",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
