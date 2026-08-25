"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AgingStrip } from "@/components/tag/aging-strip";
import { useQuery, useShop } from "@/lib/mock/store";
import { agingOf, STATUS_META } from "@/lib/status";
import { count, dueLabel, peso, shortAge } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Temporary landing page. The real day sheet arrives in stage 8; until then
 * this proves the mock data layer is wired up and shows the aging treatment
 * on live seed data.
 */
export default function Page() {
  const { db, failureRate, setFailureRate, reseed } = useShop();
  const { data: summary, loading, error, refetch } = useQuery((api) => api.getDashboard());
  const { data: tickets } = useQuery((api) =>
    api.getTickets({ includeReleased: false }),
  );

  const openTickets = (tickets ?? []).filter(
    (ticket) => !STATUS_META[ticket.status].terminal,
  );
  const urgent = openTickets.slice(0, 6);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-baseline gap-3 border-b border-rule pb-2">
        <h1 className="font-display text-base font-semibold text-ink">Day sheet</h1>
        <span className="label-pad">Stage 2 — data layer check</span>
        <Link href="/specimen" className="mono ml-auto text-xs text-bench-ink underline">
          Design specimen
        </Link>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-3 border border-stamp bg-stamp-fill p-3">
          <AlertTriangle className="mt-0.5 size-4 text-stamp-ink" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-stamp-ink">{error.message}</p>
            <p className="text-ink-soft">
              {(error as { hint?: string }).hint ?? "Try again."}
            </p>
            <button
              type="button"
              onClick={refetch}
              className="mt-2 inline-flex items-center gap-1.5 border border-rule bg-copy px-2 py-1 text-xs font-medium hover:bg-secondary"
            >
              <RefreshCw className="size-3" aria-hidden /> Try again
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-rule bg-copy">
          <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
            <span className="label-bin text-ink">Most urgent open jobs</span>
            <span className="mono ml-auto text-xs text-ink-faint">
              {count(openTickets.length)} open
            </span>
          </div>

          {loading && !tickets ? (
            <ul className="divide-y divide-rule-soft">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <li key={row} className="flex h-[52px] animate-pulse items-center gap-3 px-3">
                  <span className="h-8 w-[3px] bg-secondary" />
                  <span className="h-3 w-24 bg-secondary" />
                  <span className="h-3 w-40 bg-secondary" />
                </li>
              ))}
            </ul>
          ) : urgent.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-ink">No open job orders.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Take a unit in at the counter to start the queue.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-rule-soft">
              {urgent.map((ticket) => {
                const aging = agingOf(ticket);
                const customer = db.customers.find((entry) => entry.id === ticket.customerId);
                return (
                  <li key={ticket.id} className="flex items-stretch gap-3">
                    <AgingStrip aging={aging} />
                    <div className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs font-semibold text-ink">
                            {ticket.ticketNo}
                          </span>
                          <span className="mono rounded-[2px] border border-rule px-1 text-[0.625rem] text-ink-soft">
                            {STATUS_META[ticket.status].code}
                          </span>
                        </div>
                        <p className="truncate text-sm text-ink">
                          {customer?.name ?? "Walk-in"} · {ticket.device.brand}{" "}
                          {ticket.device.model}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "mono text-xs font-semibold",
                            aging.tier === "overdue" ? "text-stamp-ink" : "text-ink-soft",
                          )}
                        >
                          {dueLabel(ticket.promisedAt)}
                        </p>
                        <p className="mono text-[0.6875rem] text-ink-faint">
                          {shortAge(ticket.statusChangedAt)} in status
                        </p>
                      </div>
                      <span className="sr-only">{aging.srLabel}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="border border-rule bg-copy">
            <div className="border-b border-rule px-3 py-2">
              <span className="label-bin text-ink">Seed contents</span>
            </div>
            <dl className="divide-y divide-rule-soft">
              <Row label="Tickets" value={count(db.tickets.length)} />
              <Row label="Customers" value={count(db.customers.length)} />
              <Row
                label="Inventory items"
                value={`${count(db.items.length)} (${db.items.filter((i) => i.itemClass === "handset").length} / ${db.items.filter((i) => i.itemClass === "accessory").length} / ${db.items.filter((i) => i.itemClass === "spare_part").length})`}
              />
              <Row label="Handset units" value={count(db.items.reduce((sum, item) => sum + (item.units?.length ?? 0), 0))} />
              <Row label="Stock movements" value={count(db.movements.length)} />
              <Row label="Sales (90 days)" value={count(db.sales.length)} />
              <Row label="Shifts" value={count(db.shifts.length)} />
              <Row label="Timeline events" value={count(db.timeline.length)} />
              <Row
                label="Today’s sales"
                value={summary ? peso(summary.todaySales, { whole: true }) : "—"}
              />
              <Row label="Low stock" value={summary ? count(summary.lowStock) : "—"} />
            </dl>
          </section>

          <section className="border border-rule bg-copy">
            <div className="border-b border-rule px-3 py-2">
              <span className="label-bin text-ink">Mock controls</span>
            </div>
            <div className="space-y-3 px-3 py-3">
              <div>
                <p className="label-pad">Simulated failure rate</p>
                <div className="mt-1.5 flex gap-1">
                  {[0, 0.25, 1].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFailureRate(rate)}
                      className={cn(
                        "mono flex-1 border px-2 py-1 text-xs",
                        failureRate === rate
                          ? "border-bench bg-bench-fill font-semibold text-bench-ink"
                          : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                      )}
                    >
                      {rate === 0 ? "off" : `${rate * 100}%`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[0.6875rem] leading-snug text-ink-soft">
                  Makes the mock API throw, so error states can be checked without
                  a backend.
                </p>
              </div>
              <button
                type="button"
                onClick={reseed}
                className="inline-flex w-full items-center justify-center gap-1.5 border border-rule bg-paper px-2 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <RefreshCw className="size-3" aria-hidden /> Rebuild seed data
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-1.5">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="mono text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
