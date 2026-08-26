import { cn } from "@/lib/utils";

/**
 * The one surface in the system. A rounded card with a soft shadow —
 * everything that isn't a tag, a table, or a form field sits in one of these.
 */
export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-rule bg-copy shadow-raised",
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
        "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-rule px-3 py-2 sm:min-h-10 sm:px-4",
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
    <h2 className={cn("label-bin text-ink", className)} {...props}>
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
