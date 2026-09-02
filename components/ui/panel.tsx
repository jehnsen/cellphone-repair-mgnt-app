import { cn } from "@/lib/utils";

/**
 * The one surface in the system. A cut-cornered panel with a soft shadow —
 * everything that isn't a tag, a table, or a form field sits in one of these.
 *
 * Corner ticks (`.brackets`) frame it like an instrument bezel. They are
 * pseudo-elements rather than a `clip-path` notch on purpose: clipping a box
 * also clips its shadow, and these panels are the thing that floats.
 */
export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "brackets relative flex min-w-0 flex-col rounded-sm border border-rule bg-copy shadow-raised",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-rule px-3 py-2 sm:min-h-10 sm:px-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("label-bin flex items-center gap-2 text-ink", className)}
      {...props}
    >
      {/* Indicator lamp. Two pixels of accent is enough to say the bay is
          live, and it gives the mono legend something to sit against. */}
      <span
        className="size-1.5 shrink-0 bg-bench"
        style={{ boxShadow: "0 0 6px 0 var(--bench)" }}
        aria-hidden
      />
      {children}
    </h2>
  );
}

/** Right-aligned header slot: counts, filters, a single action. */
export function PanelTools({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("ml-auto flex flex-wrap items-center gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("min-w-0 p-3 sm:p-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Body variant for lists that own their own padding, row by row. */
export function PanelList({
  className,
  children,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul className={cn("min-w-0 divide-y divide-rule-soft", className)} {...props}>
      {children}
    </ul>
  );
}

export function PanelFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-wrap items-center gap-2 border-t border-rule bg-paper/60 px-3 py-2 sm:px-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Wide content — tables, boards, receipts — scrolls inside its own box. */
export function PanelScroller({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)} {...props}>
      {children}
    </div>
  );
}
