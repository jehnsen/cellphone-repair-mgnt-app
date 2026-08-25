import { cn } from "@/lib/utils";
import type { Aging } from "@/lib/status";

/**
 * The tear strip down the left edge of every tag — board card, table row,
 * detail head, printed stub. It is the only element allowed to carry colour
 * for urgency, and it always pairs colour with width and pattern so the read
 * survives greyscale, colour blindness, and a two-foot glance.
 */
export function AgingStrip({
  aging,
  perforated = false,
  className,
}: {
  aging: Aging;
  /** Perforation dots only read above ~40px; dense rows keep a solid strip. */
  perforated?: boolean;
  className?: string;
}) {
  const { tier } = aging;

  return (
    <span
      aria-hidden
      className={cn(
        "relative block h-full shrink-0",
        tier === "overdue" ? "w-1.5" : "w-[3px]",
        tier === "fresh" && "bg-rule",
        tier === "soon" && "bg-flag",
        tier === "today" && "bg-flag",
        tier === "overdue" && "bg-stamp",
        className,
      )}
    >
      {tier === "today" ? (
        <span className="hatch absolute inset-0 text-copy opacity-70" />
      ) : null}
      {perforated ? <span className="perf-strip absolute inset-0" /> : null}
    </span>
  );
}

/** The words behind the colour. Screen readers get this, not the strip. */
export function AgingLabel({ aging, className }: { aging: Aging; className?: string }) {
  return <span className={cn("sr-only", className)}>{aging.srLabel}</span>;
}
