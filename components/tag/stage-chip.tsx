import { Badge } from "@/components/ui/badge";
import { STAGE_META, stageOf } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/lib/types";

/**
 * Where a job is, in the shop's own words.
 *
 * Takes a server status and shows the *stage* it belongs to, so a unit in `qc`
 * reads "In repair" — the same thing the board column says. Use this anywhere
 * a job appears outside its column (tables, customer history, the day sheet).
 *
 * For the exact server status, use `StatusChip`; the timeline needs that
 * precision, the counter does not.
 */
export function StageChip({
  status,
  showLabel = true,
  className,
}: {
  status: TicketStatus;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = STAGE_META[stageOf(status)];

  return (
    <Badge variant={meta.fill} className={cn("gap-1.5", className)} title={meta.label}>
      <span className="mono font-semibold tracking-[0.04em]">{meta.code}</span>
      {showLabel ? <span className="truncate">{meta.label}</span> : null}
      {!showLabel ? <span className="sr-only">{meta.label}</span> : null}
    </Badge>
  );
}
