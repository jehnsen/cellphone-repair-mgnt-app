import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A soft-cornered field with a hairline edge that lights up in the accent
 * when you reach for it. 16px text on phones so iOS does not zoom.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-rule bg-copy px-3 py-1 text-base text-ink shadow-panel transition-colors outline-none",
        "placeholder:text-ink-faint hover:border-rule-strong",
        "focus-visible:border-bench focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-60",
        "aria-invalid:border-stamp aria-invalid:bg-stamp-fill",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
        "sm:h-9 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Identifiers, money, and quantities are typed in mono, not body. */
function InputMono({ className, ...props }: React.ComponentProps<"input">) {
  return <Input className={cn("mono tracking-[0.02em]", className)} {...props} />;
}

export { Input, InputMono };
