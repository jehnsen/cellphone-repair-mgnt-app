"use client";

import Link from "next/link";
import { ArrowRight, ClipboardPen, RefreshCw } from "lucide-react";
import { AgingStrip } from "@/components/tag/aging-strip";
import { PageHeader } from "@/components/shell/page-header";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelList,
  PanelTitle,
  PanelTools,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { StatusChip } from "@/components/tag/status-chip";
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
  const { data: summary, loading, error, refetch } = useQuery((api) =>
    api.getDashboard(),
  );
  const { data: tickets } = useQuery((api) => api.getTickets({ includeReleased: false }));

  const openTickets = (tickets ?? []).filter(
    (ticket) => !STATUS_META[ticket.status].terminal,
  );
  const urgent = openTickets.slice(0, 6);

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Stage 2 — data layer check"
        title="Day sheet"
        description="The real day sheet lands in stage 8. This page reads live from the mock API so the seed, the aging scale, and the loading and error states can be checked."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/specimen">
              Design specimen
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] sm:gap-5">
        <Panel>
          <PanelHeader>
            <PanelTitle>Most urgent open jobs</PanelTitle>
            <PanelTools>
              <span className="mono text-xs text-ink-faint">
                {count(openTickets.length)} open
              </span>
            </PanelTools>
          </PanelHeader>

          {loading && !tickets ? (
            <LoadingRows rows={6} />
          ) : urgent.length === 0 ? (
            <EmptyState
              icon={ClipboardPen}
              title="No open job orders."
              body="Take a unit in at the counter and it will appear here, oldest first."
              action={
                <Button asChild size="sm">
                  <Link href="/intake">New job order</Link>
                </Button>
              }
            />
          ) : (
            <PanelList>
              {urgent.map((ticket) => {
                const aging = agingOf(ticket);
                const customer = db.customers.find(
                  (entry) => entry.id === ticket.customerId,
                );

                return (
                  <li key={ticket.id} className="group flex items-stretch gap-3">
                    <AgingStrip aging={aging} />
                    <div className="tap flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-3">
                      <div className="min-w-0 flex-1 basis-48">
                        <div className="flex items-center gap-2">
                          <span className="mono text-xs font-semibold text-ink">
                            {ticket.ticketNo}
                          </span>
                          <StatusChip status={ticket.status} showLabel={false} />
                          {aging.stalled ? (
                            <span className="label-pad text-[0.5625rem] text-flag-ink">
                              stalled
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-ink">
                          {customer?.name ?? "Walk-in"} · {ticket.device.brand}{" "}
                          {ticket.device.model}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-3 sm:block sm:text-right">
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
            </PanelList>
          )}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-1">
          <Panel>
            <PanelHeader>
              <PanelTitle>Seed contents</PanelTitle>
            </PanelHeader>
            <dl className="divide-y divide-rule-soft">
              <Row label="Tickets" value={count(db.tickets.length)} />
              <Row label="Customers" value={count(db.customers.length)} />
              <Row
                label="Items (HS / AC / SP)"
                value={`${db.items.filter((i) => i.itemClass === "handset").length} / ${db.items.filter((i) => i.itemClass === "accessory").length} / ${db.items.filter((i) => i.itemClass === "spare_part").length}`}
              />
              <Row
                label="Handset units"
                value={count(
                  db.items.reduce((sum, item) => sum + (item.units?.length ?? 0), 0),
                )}
              />
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
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Mock controls</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div>
                <p className="label-pad">Simulated failure rate</p>
                <div className="mt-1.5 flex gap-1">
                  {[0, 0.25, 1].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFailureRate(rate)}
                      aria-pressed={failureRate === rate}
                      className={cn(
                        "mono tap flex-1 rounded-sm border px-2 text-xs transition-colors",
                        failureRate === rate
                          ? "border-bench bg-bench-fill font-semibold text-bench-ink"
                          : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                      )}
                    >
                      {rate === 0 ? "off" : `${rate * 100}%`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  Makes the mock API throw, so error states can be checked without a
                  backend.
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={reseed}>
                <RefreshCw aria-hidden /> Rebuild seed data
              </Button>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2 sm:px-4">
      <dt className="min-w-0 truncate text-sm text-ink-soft">{label}</dt>
      <dd className="mono shrink-0 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
