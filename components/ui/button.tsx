import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * shadcn's Button, restyled onto the shop palette. Same API, same slots — the
 * changes are: square-ish corners, a real 44px touch target on phones that
 * relaxes to 36px on pointer devices, and focus that uses the bench ring
 * instead of a translucent halo.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-stamp [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-bench text-white shadow-panel hover:bg-bench-ink active:bg-bench-ink",
        destructive:
          "bg-stamp text-white shadow-panel hover:bg-stamp-ink active:bg-stamp-ink",
        outline:
          "border border-rule bg-copy text-ink shadow-panel hover:border-rule-strong hover:bg-secondary",
        secondary: "bg-secondary text-ink hover:bg-secondary/70",
        ghost: "text-ink-soft hover:bg-secondary hover:text-ink",
        link: "text-bench-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-3.5 has-[>svg]:px-3 sm:h-9",
        xs: "h-8 gap-1 px-2 text-xs has-[>svg]:px-1.5 sm:h-6 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5 sm:h-8",
        lg: "h-11 px-6 text-[0.9375rem] has-[>svg]:px-4 sm:h-10",
        icon: "size-10 sm:size-9",
        "icon-xs": "size-8 sm:size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 sm:size-8",
        "icon-lg": "size-11 sm:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
