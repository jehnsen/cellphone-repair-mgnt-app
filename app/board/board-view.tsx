"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, ListFilter, PackageCheck, PackageOpen, Table2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelScroller } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { AgingStrip } from "@/components/tag/aging-strip";
import { StatusChip } from "@/components/tag/status-chip";
import { useMutation, useQuery, useShop } from "@/lib/mock/store";
import { agingOf, BOARD_STATUSES, nextStatuses, STATUS_META } from "@/lib/status";
import { dueLabel, shortAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

export function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const overdueOnly = searchParams.get("overdue") === "1";

  const { db, user } = useShop();
  const { data: tickets, loading, error, refetch } = useQuery((api) =>
    api.getTickets({ includeReleased: false }),
  );

  const [view, setView] = useState<"board" | "table">("board");
  const [brand, setBrand] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const markReady = useMutation((api, ticketIds: string[]) =>
    api.markReadyForPickup({ ticketIds, actorId: user.id }),
  );

  const brands = useMemo(
    () => Array.from(new Set((tickets ?? []).map((t) => t.device.brand))).sort(),
    [tickets],
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const needle = search.trim().toLowerCase();
    return (tickets ?? []).filter((ticket) => {
      if (brand !== "all" && ticket.device.brand !== brand) return false;
      if (overdueOnly && agingOf(ticket, now).tier !== "overdue") return false;
      if (needle) {
        const customer = db.customers.find((c) => c.id === ticket.customerId);
        const haystack = [
          ticket.ticketNo,
          ticket.claimCode,
          ticket.device.imei,
          ticket.device.brand,
          ticket.device.model,
          customer?.name ?? "",
          customer?.mobile ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [tickets, brand, overdueOnly, search, db.customers]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    BOARD_STATUSES.forEach((status) => map.set(status, []));
    filtered.forEach((ticket) => {
      map.get(ticket.status)?.push(ticket);
    });
    return map;
  }, [filtered]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedTickets = filtered.filter((t) => selected.has(t.id));
  const canMarkReady =
    selectedTickets.length > 0 &&
    selectedTickets.every((t) => nextStatuses(t.status).includes("ready_for_pickup"));

  /* Release handles one unit at a time — one claimant, one payment, one
     warranty slip — so this only offers itself on a single selection. */
  const releasable =
    selectedTickets.length === 1 &&
    nextStatuses(selectedTickets[0]!.status).includes("released")
      ? selectedTickets[0]!
      : null;

  const clearFilterParams = () => router.push("/board");

  const hasActiveFilters = Boolean(search || overdueOnly);

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Counter"
        title="Repair board"
        description="Every open job, oldest promise first. Overdue jobs carry the vermilion edge."
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="board">
                <Columns3 aria-hidden /> Board
              </TabsTrigger>
              <TabsTrigger value="table">
                <Table2 aria-hidden /> Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-ink-faint">
          <ListFilter className="size-3.5" aria-hidden />
          <span className="label-pad text-[0.625rem]">Filters</span>
        </div>

        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {overdueOnly ? (
          <Button
            variant="outline"
            size="sm"
            className="border-stamp/40 bg-stamp-fill text-stamp-ink hover:bg-stamp-fill/70"
            onClick={() => router.push("/board")}
          >
            Overdue only
            <X aria-hidden />
          </Button>
        ) : null}

        {search ? (
          <span className="mono inline-flex items-center gap-1.5 rounded-full border border-rule bg-copy px-2.5 py-1 text-xs text-ink-soft">
            “{search}”
            <button
              type="button"
              onClick={() => router.push("/board")}
              aria-label="Clear search"
              className="text-ink-faint hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ) : null}

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilterParams}>
            Clear filters
          </Button>
        ) : null}

        <span className="mono ml-auto text-xs text-ink-faint">
          {filtered.length} of {(tickets ?? []).length} open
        </span>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {selected.size > 0 ? (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-bench/30 bg-bench-fill px-3 py-2 shadow-raised sm:top-12">
          <span className="text-sm font-semibold text-bench-ink">
            {selected.size} selected
          </span>

          {canMarkReady ? (
            <Button
              size="sm"
              variant="outline"
              className="bg-copy"
              disabled={markReady.pending}
              onClick={() => {
                const ids = Array.from(selected);
                markReady.mutate(ids).then((result) => {
                  if (result) {
                    toast.success(`Marked ${result.length} ticket${result.length === 1 ? "" : "s"} ready for pickup.`);
                    clearSelection();
                  }
                });
              }}
            >
              <PackageCheck aria-hidden /> Mark ready for pickup
            </Button>
          ) : null}

          {releasable ? (
            <Button
              size="sm"
              className="bg-copy"
              variant="outline"
              onClick={() =>
                router.push(`/release?code=${encodeURIComponent(releasable.ticketNo)}`)
              }
            >
              <PackageOpen aria-hidden /> Release {releasable.ticketNo}
            </Button>
          ) : null}

          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      ) : null}

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsContent value="board" className="mt-0">
          {loading && !tickets ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Panel key={i}>
                  <LoadingRows rows={3} />
                </Panel>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Columns3}
                title="No jobs match these filters."
                body="Clear a filter or start a new job order from the counter."
                action={
                  <Button asChild size="sm">
                    <Link href="/intake">New job order</Link>
                  </Button>
                }
              />
            </Panel>
          ) : (
            <PanelScroller>
              <div className="flex gap-3 pb-2">
                {BOARD_STATUSES.map((status) => {
                  const meta = STATUS_META[status];
                  const columnTickets = byColumn.get(status) ?? [];
                  return (
                    <div key={status} className="w-72 shrink-0 sm:w-80">
                      <div className="flex items-center gap-2 px-1 pb-2">
                        <span className="label-bin text-ink">{meta.label}</span>
                        <span className="mono text-xs text-ink-faint">
                          {columnTickets.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {columnTickets.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-rule-soft px-3 py-6 text-center text-xs text-ink-faint">
                            Empty
                          </div>
                        ) : (
                          columnTickets.map((ticket) => (
                            <BoardCard
                              key={ticket.id}
                              ticket={ticket}
                              selected={selected.has(ticket.id)}
                              onToggle={() => toggleSelected(ticket.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PanelScroller>
          )}
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <Panel>
            {loading && !tickets ? (
              <LoadingRows rows={8} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Table2}
                title="No jobs match these filters."
                body="Clear a filter or start a new job order from the counter."
                action={
                  <Button asChild size="sm">
                    <Link href="/intake">New job order</Link>
                  </Button>
                }
              />
            ) : (
              <PanelScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9">
                        <Checkbox
                          checked={selected.size > 0 && selected.size === filtered.length}
                          onCheckedChange={(checked) =>
                            setSelected(checked ? new Set(filtered.map((t) => t.id)) : new Set())
                          }
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer / device</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>In status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ticket) => {
                      const customer = db.customers.find((c) => c.id === ticket.customerId);
                      const aging = agingOf(ticket);
                      return (
                        <TableRow key={ticket.id} data-state={selected.has(ticket.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(ticket.id)}
                              onCheckedChange={() => toggleSelected(ticket.id)}
                              aria-label={`Select ${ticket.ticketNo}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AgingStrip aging={aging} className="h-6" />
                              <span className="mono font-semibold text-ink">{ticket.ticketNo}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={ticket.status} showLabel={false} />
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-ink">{customer?.name ?? "Walk-in"}</p>
                            <p className="truncate text-xs text-ink-soft">
                              {ticket.device.brand} {ticket.device.model}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className={cn("mono text-xs font-semibold", aging.tier === "overdue" ? "text-stamp-ink" : "text-ink-soft")}>
                              {dueLabel(ticket.promisedAt)}
                            </span>
                          </TableCell>
                          <TableCell className="mono text-xs text-ink-faint">
                            {shortAge(ticket.statusChangedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </PanelScroller>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BoardCard({
  ticket,
  selected,
  onToggle,
}: {
  ticket: Ticket;
  selected: boolean;
  onToggle: () => void;
}) {
  const { db } = useShop();
  const aging = agingOf(ticket);
  const customer = db.customers.find((c) => c.id === ticket.customerId);

  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg border bg-copy shadow-raised transition-colors",
        selected ? "border-bench ring-1 ring-bench" : "border-rule",
      )}
    >
      <AgingStrip aging={aging} />
      <div className="min-w-0 flex-1 p-2.5">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Select ${ticket.ticketNo}`}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-xs font-semibold text-ink">{ticket.ticketNo}</span>
              {aging.stalled ? (
                <span className="label-pad text-[0.5625rem] text-flag-ink">stalled</span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium text-ink">
              {customer?.name ?? "Walk-in"}
            </p>
            <p className="truncate text-xs text-ink-soft">
              {ticket.device.brand} {ticket.device.model}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "mono text-[0.6875rem] font-semibold",
                  aging.tier === "overdue" ? "text-stamp-ink" : "text-ink-soft",
                )}
              >
                {dueLabel(ticket.promisedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
