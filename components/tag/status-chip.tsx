import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types";

/**
 * Status, carried by a two-letter code and a fill weight. No hue: on the board
 * colour belongs to urgency, and a status chip that borrowed a colour would
 * compete with the thing that actually needs looking at.
 */
export function StatusChip({
  status,
  showLabel = true,
  className,
}: {
  status: TicketStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];

  return (
    <Badge
      variant={meta.fill}
      className={cn("gap-1.5", className)}
      title={meta.label}
    >
      <span className="mono font-semibold tracking-[0.04em]">{meta.code}</span>
      {showLabel ? <span className="truncate">{meta.label}</span> : null}
      {!showLabel ? <span className="sr-only">{meta.label}</span> : null}
    </Badge>
  );
}
