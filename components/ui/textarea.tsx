import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-20 w-full rounded-sm border border-rule bg-copy px-2.5 py-2 text-base text-ink shadow-panel transition-colors outline-none",
        "placeholder:text-ink-faint hover:border-rule-strong",
        "focus-visible:border-bench focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-60",
        "aria-invalid:border-stamp aria-invalid:bg-stamp-fill",
        "sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
