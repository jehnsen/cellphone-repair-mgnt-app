import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * shadcn's Button, restyled onto the shop palette. Same API, same slots — the
 * changes are: soft corners, a real 44px touch target on phones that relaxes
 * to 36px on pointer devices, focus that uses the bench ring instead of a
 * translucent halo, and a filled variant that reads as a lit key rather than
 * a printed block — a sheen from above, a coloured glow beneath, and a 1px
 * press. Transitions cover transform and shadow, not just colour.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-stamp [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "sheen bg-bench text-white shadow-glow hover:bg-bench-ink hover:-translate-y-px active:translate-y-0 active:shadow-panel",
        destructive:
          "sheen bg-stamp text-white shadow-raised hover:bg-stamp-ink hover:-translate-y-px active:translate-y-0 active:shadow-panel",
        outline:
          "border border-rule bg-copy text-ink shadow-panel hover:border-bench/45 hover:bg-bench-fill hover:text-bench-ink",
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
