import { cn } from "@/lib/utils";
import { formatClaimCode } from "@/lib/format";
import type { Aging } from "@/lib/status";

/**
 * The signature: a service tag header.
 *
 * The same anatomy appears at three scales — the board card, this detail head,
 * and the printed claim stub. The ticket number leads, the claim code sits in
 * its own accent chip, and the left edge carries urgency.
 *
 * All boldness in this system is spent here. Everything else stays quiet.
 */
export function TagHead({
  ticketNo,
  claimCode,
  aging,
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  ticketNo: string;
  claimCode: string;
  aging?: Aging;
  /** Customer name, or whatever names this job to a human. */
  title?: string;
  /** Device line. */
  subtitle?: string;
  /** Small key/value pairs printed under the rule. */
  meta?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  className?: string;
}) {
  const tier = aging?.tier ?? "fresh";

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-lg border border-rule bg-copy shadow-raised",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "shrink-0",
          tier === "overdue" ? "w-1.5" : "w-1",
          tier === "fresh" && "bg-rule",
          tier === "soon" && "bg-flag",
          tier === "today" && "bg-flag",
          tier === "overdue" && "bg-stamp",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="min-w-0">
            <p className="label-pad">Job order no.</p>
            <p className="mono mt-0.5 text-xl font-semibold leading-none tracking-[-0.01em] text-ink sm:text-2xl">
              {ticketNo}
            </p>
            <span
              className={cn(
                "mt-1.5 block h-[3px] w-full max-w-[13ch]",
                tier === "overdue" ? "bg-stamp" : "bg-ink",
              )}
              aria-hidden
            />
            {title ? (
              <p className="mt-2 truncate text-sm font-semibold text-ink">{title}</p>
            ) : null}
            {subtitle ? (
              <p className="truncate text-sm text-ink-soft">{subtitle}</p>
            ) : null}
          </div>

          {/* Read aloud over the phone all day, so it is grouped 4-2 and set
              in the widest tracking in the system. */}
          <div className="shrink-0">
            <p className="label-pad">Claim code</p>
            <p className="mono mt-0.5 inline-block rounded-md bg-bench-fill px-2.5 py-1 text-lg font-semibold leading-none tracking-[0.18em] text-bench-ink sm:text-xl">
              {formatClaimCode(claimCode)}
            </p>
          </div>

          {actions ? (
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
              {actions}
            </div>
          ) : null}
        </div>

        {meta?.length ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule px-3 py-2.5 sm:px-4">
            {meta.map((entry) => (
              <div key={entry.label} className="min-w-0">
                <dt className="label-pad text-[0.625rem]">{entry.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-ink">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
