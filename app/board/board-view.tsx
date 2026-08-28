"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Columns3,
  ListFilter,
  PackageCheck,
  PackageOpen,
  Table2,
  X,
} from "lucide-react";
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
import { StageChip } from "@/components/tag/stage-chip";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { agingOf, nextStatuses } from "@/lib/status";
import type { Stage } from "@/lib/stages";
import {
  agingLabel,
  BOARD_MOVES,
  BOARD_STAGES,
  canReach,
  moveLabel,
  STAGE_META,
  stageOf,
} from "@/lib/stages";
import { dueLabel, shortAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Ticket, TicketStatus } from "@/lib/types";

export function BoardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const overdueOnly = searchParams.get("overdue") === "1";

  const { db, user, api } = useShop();
  const { data: tickets, loading, error, refetch } = useQuery((api) =>
    api.getTickets({ includeReleased: false }),
  );

  const [view, setView] = useState<"board" | "table">("board");
  const [brand, setBrand] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const markReady = useMutation((api, ticketIds: string[]) =>
    api.markReadyForPickup({ ticketIds, actorId: user.id }),
  );

  /* One transition at a time, applied across the selection. The server is the
     authority on whether a move is legal, so a rejection stops the run rather
     than pressing on and leaving the board half-moved. */
  const [moveTo, setMoveTo] = useState<TicketStatus | null>(null);
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);

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

  /* Columns are stages, not statuses: one person does not think in eleven
     states. lib/stages.ts holds which statuses fold into which column. */
  const byColumn = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    BOARD_STAGES.forEach((stage) => map.set(stage, []));
    filtered.forEach((ticket) => {
      map.get(stageOf(ticket.status))?.push(ticket);
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
    /* Only from the bench onwards. Reachability alone would offer this on a
       just-received unit, silently skipping diagnosis and the repair itself. */
    selectedTickets.every((t) => stageOf(t.status) === "in_repair");

  /* Only moves legal for EVERY selected ticket are offered, so a mixed
     selection can never half-apply. Release and pickup have their own
     dedicated buttons (and their own screens), so they are not repeated
     in the generic mover. */
  const commonMoves = useMemo<TicketStatus[]>(() => {
    if (!selectedTickets.length) return [];
    /* Reachable, not just directly legal: the client walks the server's hops,
       so "in repair" is offered from "to check" even though that is two moves. */
    return BOARD_MOVES.filter((move) =>
      selectedTickets.every((ticket) => canReach(ticket.status, move.to)),
    ).map((move) => move.to);
  }, [selectedTickets]);

  const applyMove = async () => {
    if (!moveTo || !selectedTickets.length) return;
    setMoving(true);
    const label = moveLabel(moveTo).toLowerCase();
    let done = 0;
    try {
      for (const ticket of selectedTickets) {
        await api.setTicketStatus({
          ticketId: ticket.id,
          status: moveTo,
          actorId: user.id,
          note: note.trim() || undefined,
        });
        done += 1;
      }
      toast.success(`Moved ${done} ticket${done === 1 ? "" : "s"} to ${label}.`);
      setMoveTo(null);
      setNote("");
      clearSelection();
    } catch (caught) {
      /* Some may already have moved — say so rather than implying none did. */
      const { message, description } = toastError(caught, "Could not move the ticket.");
      toast.error(message, {
        description: done
          ? `${done} moved before this failed. ${description ?? ""}`.trim()
          : description,
      });
    } finally {
      setMoving(false);
      refetch();
    }
  };

  /* ── Drag and drop ───────────────────────────────────────────────────
     Dragging a card to a column is the same move as picking it from the
     mover — it just skips the ticking. The checkboxes stay: drag is a
     pointer gesture, and keyboard and touch still need the old path.

     Dragging a card that is part of a selection carries the whole
     selection, so "tick three, drag one" moves all three. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<Stage | null>(null);

  const draggedTickets = (id: string): Ticket[] => {
    if (selected.has(id) && selectedTickets.length > 1) return selectedTickets;
    const one = filtered.find((ticket) => ticket.id === id);
    return one ? [one] : [];
  };

  /** A drop is legal only if every carried ticket can reach that stage. */
  const canDropOn = (stage: Stage, id: string | null): boolean => {
    if (!id) return false;
    const carried = draggedTickets(id);
    if (!carried.length) return false;
    const target = STAGE_META[stage].entry;
    return carried.every(
      (ticket) => stageOf(ticket.status) !== stage && canReach(ticket.status, target),
    );
  };

  const dropOn = async (stage: Stage, id: string) => {
    const carried = draggedTickets(id);
    const target = STAGE_META[stage].entry;
    setDraggingId(null);
    setDropStage(null);
    if (!carried.length) return;

    setMoving(true);
    let done = 0;
    try {
      for (const ticket of carried) {
        await api.setTicketStatus({
          ticketId: ticket.id,
          status: target,
          actorId: user.id,
        });
        done += 1;
      }
      toast.success(
        `Moved ${done} ticket${done === 1 ? "" : "s"} to ${STAGE_META[stage].label.toLowerCase()}.`,
      );
      clearSelection();
    } catch (caught) {
      const { message, description } = toastError(caught, "Could not move the ticket.");
      toast.error(message, {
        description: done
          ? `${done} moved before this failed. ${description ?? ""}`.trim()
          : description,
      });
    } finally {
      setMoving(false);
      refetch();
    }
  };

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

          {commonMoves.length ? (
            <Select
              value={moveTo ?? ""}
              onValueChange={(v) => setMoveTo(v as TicketStatus)}
            >
              <SelectTrigger size="sm" className="w-auto min-w-40 bg-copy">
                <ArrowRightLeft className="size-3.5" aria-hidden />
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {commonMoves.map((status) => (
                  <SelectItem key={status} value={status}>
                    {moveLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {canMarkReady ? (
            <Button
              size="sm"
              variant="outline"
              className="bg-copy"
              disabled={markReady.pending}
              onClick={() => {
                const ids = Array.from(selected);
                markReady.mutate(ids).then(({ data: result, error }) => {
                  if (result) {
                    toast.success(`Moved ${result.length} ticket${result.length === 1 ? "" : "s"} to ready to claim.`);
                    clearSelection();
                  } else if (error) {
                    const { message, description } = toastError(
                      error,
                      "Could not mark the tickets ready.",
                    );
                    toast.error(message, { description });
                  }
                });
              }}
            >
              <PackageCheck aria-hidden /> Tested — ready to claim
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
                {BOARD_STAGES.map((stage) => {
                  const meta = STAGE_META[stage];
                  const columnTickets = byColumn.get(stage) ?? [];
                  const droppable = canDropOn(stage, draggingId);
                  const isTarget = dropStage === stage && droppable;

                  return (
                    <div
                      key={stage}
                      className="w-72 shrink-0 sm:w-80"
                      onDragOver={(event) => {
                        /* Only calling preventDefault marks this a valid drop
                           target, so an illegal move refuses the cursor. */
                        if (!droppable) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropStage(stage);
                      }}
                      onDragLeave={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node)) {
                          return;
                        }
                        setDropStage((current) => (current === stage ? null : current));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id =
                          event.dataTransfer.getData("text/plain") || draggingId;
                        if (id && canDropOn(stage, id)) void dropOn(stage, id);
                      }}
                    >
                      <div className="px-1 pb-2">
                        <div className="flex items-baseline gap-2">
                          <span className="label-bin truncate text-ink">{meta.label}</span>
                          <span className="mono text-xs text-ink-faint">
                            {columnTickets.length}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[0.6875rem] leading-tight text-ink-faint">
                          {meta.hint}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "space-y-2 rounded-lg border border-transparent p-1 transition-colors",
                          isTarget && "border-dashed border-bench bg-bench-fill",
                          draggingId && !droppable && "opacity-45",
                        )}
                      >
                        {columnTickets.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-rule-soft px-3 py-6 text-center text-xs text-ink-faint">
                            {isTarget ? "Drop to move here" : "Empty"}
                          </div>
                        ) : (
                          columnTickets.map((ticket) => (
                            <BoardCard
                              key={ticket.id}
                              ticket={ticket}
                              selected={selected.has(ticket.id)}
                              onToggle={() => toggleSelected(ticket.id)}
                              dragging={draggingId === ticket.id}
                              disabled={moving}
                              onDragStart={(event) => {
                                event.dataTransfer.setData("text/plain", ticket.id);
                                event.dataTransfer.effectAllowed = "move";
                                setDraggingId(ticket.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDropStage(null);
                              }}
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
                      <TableHead>Stage</TableHead>
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
                              <Link
                                href={`/board/${ticket.id}`}
                                className="mono font-semibold text-ink hover:text-bench-ink hover:underline"
                              >
                                {ticket.ticketNo}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StageChip status={ticket.status} />
                          </TableCell>
                          <TableCell>
                            <p className="truncate text-ink">{customer?.name ?? "Walk-in"}</p>
                            <p className="truncate text-xs text-ink-soft">
                              {ticket.device.brand} {ticket.device.model}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className={cn("mono text-xs font-semibold", aging.tier === "overdue" ? "text-stamp-ink" : "text-ink-soft")}>
                              {agingLabel(ticket)}
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

      {/* Confirm the move and, optionally, say why. The note lands on the
          ticket's timeline, which is the only durable record of why a job
          changed hands. */}
      <Dialog
        open={Boolean(moveTo)}
        onOpenChange={(open) => {
          if (!open && !moving) {
            setMoveTo(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {selectedTickets.length} ticket
              {selectedTickets.length === 1 ? "" : "s"} to{" "}
              {moveTo ? moveLabel(moveTo).toLowerCase() : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="max-h-40 divide-y divide-rule-soft overflow-y-auto rounded-lg border border-rule">
              {selectedTickets.map((ticket) => {
                const customer = db.customers.find((c) => c.id === ticket.customerId);
                return (
                  <li
                    key={ticket.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  >
                    <span className="mono font-semibold text-ink">
                      {ticket.ticketNo}
                    </span>
                    <span className="truncate text-ink-soft">
                      {customer?.name ?? "Walk-in"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1.5">
              <Label htmlFor="move-note">Note (optional)</Label>
              <Textarea
                id="move-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={
                  moveTo === "unrepairable"
                    ? "Why the unit cannot be repaired — the customer will be told this."
                    : "What changed, for the ticket's timeline."
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={moving}
                onClick={() => {
                  setMoveTo(null);
                  setNote("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={applyMove} disabled={moving}>
                {moving ? "Moving…" : "Move"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoardCard({
  ticket,
  selected,
  onToggle,
  dragging,
  disabled,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  selected: boolean;
  onToggle: () => void;
  dragging?: boolean;
  disabled?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}) {
  const { db } = useShop();
  const aging = agingOf(ticket);
  const customer = db.customers.find((c) => c.id === ticket.customerId);

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      /* The whole card drags; the checkbox and the link inside still take
         their own clicks, because a drag only starts once the pointer moves. */
      className={cn(
        "flex items-stretch overflow-hidden rounded-lg border bg-copy shadow-raised transition-colors",
        selected ? "border-bench ring-1 ring-bench" : "border-rule",
        !disabled && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
        disabled && "pointer-events-none opacity-60",
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
              <Link
                href={`/board/${ticket.id}`}
                className="mono text-xs font-semibold text-ink hover:text-bench-ink hover:underline"
              >
                {ticket.ticketNo}
              </Link>
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
                {agingLabel(ticket)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
