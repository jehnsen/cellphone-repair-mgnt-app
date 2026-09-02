import { cn } from "@/lib/utils";
import type { Aging } from "@/lib/status";

/**
 * The accent bar down the left edge of every tag — board card, table row,
 * detail head. It is the only element allowed to carry colour for urgency,
 * and it always pairs colour with width so the read survives greyscale,
 * colour blindness, and a two-foot glance.
 */
export function AgingStrip({
  aging,
  perforated = false,
  className,
}: {
  aging: Aging;
  /** Kept for call-site compatibility; the perforation motif was retired. */
  perforated?: boolean;
  className?: string;
}) {
  const { tier } = aging;
  void perforated;

  return (
    <span
      aria-hidden
      className={cn(
        /* self-stretch, not h-full: the parent row rarely has a resolved
           height, so h-full collapses the strip to nothing. */
        "block shrink-0 self-stretch rounded-sm",
        tier === "overdue" ? "w-1.5" : "w-1",
        tier === "fresh" && "bg-rule",
        tier === "soon" && "bg-flag",
        tier === "today" && "bg-flag",
        tier === "overdue" && "bg-stamp",
        className,
      )}
    />
  );
}

/** The words behind the colour. Screen readers get this, not the strip. */
export function AgingLabel({ aging, className }: { aging: Aging; className?: string }) {
  return <span className={cn("sr-only", className)}>{aging.srLabel}</span>;
}
