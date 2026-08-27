"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardPen,
  Columns3,
  MessageSquareWarning,
  PackageCheck,
  RefreshCw,
  ScanBarcode,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AgingStrip } from "@/components/tag/aging-strip";
import { PageHeader } from "@/components/shell/page-header";
import { DataSourceNotice } from "@/components/shell/data-source-notice";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelList,
  PanelTitle,
  PanelTools,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { StatusChip } from "@/components/tag/status-chip";
import { useQuery, useShop } from "@/lib/shop/store";
import { agingOf, BOARD_STATUSES, STATUS_META } from "@/lib/status";
import { count, dueLabel, formatTime, peso, shortAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

export function DaySheetView() {
  const { db, user } = useShop();
  const {
    data: summary,
    loading,
    error,
    refetch,
  } = useQuery((api) => api.getDashboard());
  const { data: tickets } = useQuery((api) =>
    api.getTickets({ includeReleased: false }),
  );

  const now = new Date();
  const open = useMemo(
    () => (tickets ?? []).filter((t) => !STATUS_META[t.status].terminal),
    [tickets],
  );

  const overdue = useMemo(
    () =>
      open
        .filter((t) => agingOf(t, now).tier === "overdue")
        .sort(
          (a, b) =>
            new Date(a.promisedAt).getTime() - new Date(b.promisedAt).getTime(),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  /* Longest-waiting quote first — that is the one to chase. */
  const awaitingApproval = useMemo(
    () =>
      open
        .filter((t) => t.status === "awaiting_approval")
        .sort(
          (a, b) =>
            new Date(a.quoteSentAt ?? a.statusChangedAt).getTime() -
            new Date(b.quoteSentAt ?? b.statusChangedAt).getTime(),
        ),
    [open],
  );

  const readyForPickup = useMemo(
    () =>
      open
        .filter((t) => t.status === "ready_for_pickup")
        .sort(
          (a, b) =>
            new Date(a.statusChangedAt).getTime() -
            new Date(b.statusChangedAt).getTime(),
        ),
    [open],
  );

  const queuedNotices = useMemo(
    () => db.notifications.filter((n) => n.state === "queued"),
    [db.notifications],
  );

  const dueToday = useMemo(
    () => open.filter((t) => agingOf(t, now).tier === "today"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const shiftOpen = summary?.openShiftId != null;

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow={`Good ${greeting()}, ${user.name.split(" ")[0]}`}
        title="Day sheet"
        description="What is late, what is waiting, and what needs a decision — before the counter opens."
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/intake">
                <ClipboardPen aria-hidden /> New job order
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pos">
                <ScanBarcode aria-hidden /> Point of sale
              </Link>
            </Button>
          </>
        }
      />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {/* The drawer is the first thing to check at open. */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 sm:px-4",
          shiftOpen ? "border-rule bg-copy" : "border-flag/40 bg-flag-fill",
        )}
      >
          <Wallet
          className={cn(
            "size-4 shrink-0",
            shiftOpen ? "text-ink-faint" : "text-flag-ink",
          )}
          aria-hidden
        />
        {shiftOpen ? (
          <>
            <span className="text-sm text-ink">Drawer is open.</span>
            <span className="mono text-sm font-semibold text-ink">
              {summary?.cashOnHand != null
                ? peso(summary.cashOnHand, { whole: true })
                : "—"}
            </span>
            <span className="text-xs text-ink-soft">on hand</span>
            <Button asChild variant="ghost" size="xs" className="ml-auto">
              <Link href="/pos">Open POS</Link>
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-flag-ink">
              No shift is open.
            </span>
            <span className="text-xs text-ink-soft">
              Count the starting cash before ringing up a sale.
            </span>
            <Button asChild variant="outline" size="xs" className="ml-auto bg-copy">
              <Link href="/pos">Open the drawer</Link>
            </Button>
          </>
        )}
      </div>

      {/* Counts that route somewhere. Numbers, not charts. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CountTile
          label="Overdue"
          value={summary?.overdue}
          loading={loading && !summary}
          href="/board?overdue=1"
          tone={(summary?.overdue ?? 0) > 0 ? "stamp" : "quiet"}
          icon={TriangleAlert}
          hint="past the promised date"
        />
        <CountTile
          label="Due today"
          value={dueToday.length}
          loading={loading && !tickets}
          href="/board"
          tone={dueToday.length > 0 ? "flag" : "quiet"}
          icon={Columns3}
          hint="promised before closing"
        />
        <CountTile
          label="Ready for pickup"
          value={summary?.readyForPickup}
          loading={loading && !summary}
          href="/release"
          tone="quiet"
          icon={PackageCheck}
          hint="waiting at the counter"
        />
        <CountTile
          label="Awaiting approval"
          value={summary?.awaitingApproval}
          loading={loading && !summary}
          href="/board"
          tone={(summary?.awaitingApproval ?? 0) > 0 ? "flag" : "quiet"}
          icon={MessageSquareWarning}
          hint="customer has not replied"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] sm:gap-5">
        <div className="space-y-4 sm:space-y-5">
          {/* Overdue leads: it is the only thing that is already wrong. */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Overdue</PanelTitle>
              <PanelTools>
                <span className="mono text-xs text-ink-faint">
                  {count(overdue.length)}
                </span>
                {overdue.length > 0 ? (
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/board?overdue=1">
                      Board <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </PanelTools>
            </PanelHeader>

            {loading && !tickets ? (
              <LoadingRows rows={4} />
            ) : overdue.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Nothing is overdue."
                body="Every open job is still inside its promised date."
              />
            ) : (
              <PanelList>
                {overdue.slice(0, 6).map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </PanelList>
            )}
          </Panel>

          {/* Waiting on the customer — a phone call, not bench work. */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Waiting on the customer</PanelTitle>
              <PanelTools>
                <span className="mono text-xs text-ink-faint">
                  {count(awaitingApproval.length)}
                </span>
              </PanelTools>
            </PanelHeader>

            {loading && !tickets ? (
              <LoadingRows rows={3} />
            ) : awaitingApproval.length === 0 ? (
              <EmptyState
                icon={MessageSquareWarning}
                title="No quotes are pending."
                body="Jobs whose quote has been sent but not answered land here."
              />
            ) : (
              <PanelList>
                {awaitingApproval.slice(0, 5).map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} showQuote />
                ))}
              </PanelList>
            )}
          </Panel>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Longest-waiting first: these are tomorrow's unclaimed units. */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Ready for pickup</PanelTitle>
              <PanelTools>
                {readyForPickup.length > 0 ? (
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/release">
                      Release <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </PanelTools>
            </PanelHeader>

            {loading && !tickets ? (
              <LoadingRows rows={3} />
            ) : readyForPickup.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Nothing waiting."
                body="Units marked ready will queue here for release."
              />
            ) : (
              <ul className="divide-y divide-rule-soft">
                {readyForPickup.slice(0, 6).map((ticket) => {
                  const customer = db.customers.find(
                    (c) => c.id === ticket.customerId,
                  );
                  return (
                    <li
                      key={ticket.id}
                      className="flex items-center gap-2.5 px-3 py-2 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          {customer?.name ?? "Walk-in"}
                        </p>
                        <p className="mono truncate text-xs text-ink-faint">
                          {ticket.ticketNo}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mono text-xs text-ink-soft">
                          {shortAge(ticket.statusChangedAt)}
                        </p>
                        {ticket.balance > 0 ? (
                          <p className="mono text-[0.6875rem] text-stamp-ink">
                            {peso(ticket.balance)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {queuedNotices.length > 0 ? (
            <Panel>
              <PanelHeader>
                <BellRing className="size-3.5 text-ink-faint" aria-hidden />
                <PanelTitle>Messages to send</PanelTitle>
                <span className="mono ml-auto text-xs text-ink-faint">
                  {count(queuedNotices.length)}
                </span>
              </PanelHeader>
              <PanelBody className="space-y-2">
                <p className="text-xs leading-relaxed text-ink-soft">
                  Pickup notices are queued but nothing sends them in this build.
                  A backend would drain this outbox.
                </p>
                <ul className="space-y-1.5">
                  {queuedNotices.slice(0, 3).map((notice) => {
                    const customer = db.customers.find(
                      (c) => c.id === notice.customerId,
                    );
                    return (
                      <li
                        key={notice.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Badge variant="outline">{notice.channel}</Badge>
                        <span className="min-w-0 flex-1 truncate text-ink-soft">
                          {customer?.name ?? "Customer"}
                        </span>
                        <span className="mono text-ink-faint">
                          {formatTime(notice.queuedAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </PanelBody>
            </Panel>
          ) : null}

          {/* Where the work is sitting, at a glance. */}
          <Panel>
            <PanelHeader>
              <PanelTitle>Board at a glance</PanelTitle>
              <span className="mono ml-auto text-xs text-ink-faint">
                {count(open.length)} open
              </span>
            </PanelHeader>
            <ul className="divide-y divide-rule-soft">
              {BOARD_STATUSES.map((status) => {
                const meta = STATUS_META[status];
                const n = open.filter((t) => t.status === status).length;
                const share = open.length > 0 ? n / open.length : 0;
                return (
                  <li
                    key={status}
                    className="flex items-center gap-3 px-3 py-1.5 sm:px-4"
                  >
                    <span className="w-28 shrink-0 truncate text-xs text-ink-soft">
                      {meta.label}
                    </span>
                    {/* Fixed-width track so every bar shares one scale. */}
                    <span className="h-1.5 min-w-0 flex-1 rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-bench"
                        style={{ width: `${Math.round(share * 100)}%` }}
                        aria-hidden
                      />
                    </span>
                    <span className="mono w-6 shrink-0 text-right text-xs text-ink">
                      {n}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {(summary?.lowStock ?? 0) > 0 ? (
            <Panel>
              <PanelBody className="flex items-center gap-3">
                <TriangleAlert className="size-4 shrink-0 text-flag-ink" aria-hidden />
                <p className="min-w-0 flex-1 text-sm text-ink">
                  {count(summary!.lowStock)} item
                  {summary!.lowStock === 1 ? " is" : "s are"} at or below the
                  reorder point.
                </p>
                <Button asChild variant="outline" size="xs">
                  <Link href="/inventory">Inventory</Link>
                </Button>
              </PanelBody>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Where these numbers come from, and what is not wired up yet. */}
      <DataSourceNotice />
    </div>
  );
}

/** A number that routes somewhere. Tone is spent on urgency only. */
function CountTile({
  label,
  value,
  loading,
  href,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  href: string;
  tone: "quiet" | "flag" | "stamp";
  icon: LucideIcon;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-lg border p-3 transition-colors sm:p-4",
        tone === "stamp"
          ? "border-stamp/40 bg-stamp-fill hover:bg-stamp-fill/70"
          : tone === "flag"
            ? "border-flag/40 bg-flag-fill hover:bg-flag-fill/70"
            : "border-rule bg-copy shadow-panel hover:bg-secondary",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "size-3.5",
            tone === "stamp"
              ? "text-stamp-ink"
              : tone === "flag"
                ? "text-flag-ink"
                : "text-ink-faint",
          )}
          aria-hidden
        />
        <span className="label-pad">{label}</span>
      </div>
      <p
        className={cn(
          "figure mt-1.5 text-2xl",
          tone === "stamp"
            ? "text-stamp-ink"
            : tone === "flag"
              ? "text-flag-ink"
              : "text-ink",
        )}
      >
        {loading ? "—" : count(value ?? 0)}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function TicketRow({
  ticket,
  showQuote,
}: {
  ticket: Ticket;
  showQuote?: boolean;
}) {
  const { db } = useShop();
  const aging = agingOf(ticket);
  const customer = db.customers.find((c) => c.id === ticket.customerId);

  return (
    <li className="group flex items-stretch gap-3">
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
            {showQuote && ticket.quoteSentAt
              ? `quoted ${shortAge(ticket.quoteSentAt)} ago`
              : `${shortAge(ticket.statusChangedAt)} in status`}
          </p>
        </div>
        <span className="sr-only">{aging.srLabel}</span>
      </div>
    </li>
  );
}
