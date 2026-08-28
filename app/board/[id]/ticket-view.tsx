"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  History,
  PackageOpen,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { TagHead } from "@/components/tag/tag-head";
import { FindingPanel } from "@/components/ticket/finding-panel";
import { PaymentDialog } from "@/components/ticket/payment-dialog";
import { useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { agingOf } from "@/lib/status";
import { moveLabel, STAGE_META, stageActions, stageOf } from "@/lib/stages";
import { formatDate, formatDateTime, formatImei, formatMobile, money, peso } from "@/lib/format";
import { PROBLEM_LABEL } from "@/lib/problems";
import { cn } from "@/lib/utils";
import type { RepairFinding, TicketStatus } from "@/lib/types";

const CONDITION_LABEL: Record<string, string> = {
  screen_cracked: "Screen cracked",
  back_cracked: "Back cracked",
  dents: "Dents",
  scratches: "Scratches",
  water_indicator: "Water indicator tripped",
  missing_screws: "Missing screws",
  prior_repair: "Signs of prior repair",
  powers_on: "Powers on",
  buttons_ok: "Buttons OK",
  camera_ok: "Camera OK",
};

const TURNED_OVER_LABEL: Record<string, string> = {
  sim: "SIM card",
  sd_card: "SD card",
  case: "Case",
  charger: "Charger",
  box: "Box",
};

export function TicketView({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { db, user, api } = useShop();

  const {
    data: ticket,
    loading,
    error,
    refetch,
  } = useQuery((api) => api.getTicket(ticketId), [ticketId]);

  const { data: timeline } = useQuery(
    (api) => api.getTimeline(ticketId),
    [ticketId],
  );

  /* Findings live behind their own endpoint, so they load separately and a
     404 (none recorded) is not an error. */
  const { data: fetchedFinding, refetch: refetchFinding } = useQuery(
    (api) => api.getFinding(ticketId),
    [ticketId],
  );
  const [localFinding, setLocalFinding] = useState<RepairFinding | null>(null);
  const finding = localFinding ?? fetchedFinding ?? null;

  const [paying, setPaying] = useState(false);
  const [moveTo, setMoveTo] = useState<TicketStatus | null>(null);
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);

  /* Resolve the customer from the cache when it is warm, but fall back to a
     direct fetch: arriving here by link (or a refresh) does not guarantee the
     customer list has been loaded, and showing "Walk-in" for a named customer
     would be a lie. */
  const cachedCustomer = ticket
    ? db.customers.find((c) => c.id === ticket.customerId)
    : undefined;
  const { data: fetchedCustomer } = useQuery(
    (api) =>
      ticket?.customerId && !cachedCustomer
        ? api.getCustomer(ticket.customerId).catch(() => null)
        : Promise.resolve(null),
    [ticket?.customerId, Boolean(cachedCustomer)],
  );
  const customer = cachedCustomer ?? fetchedCustomer ?? null;
  const technician = useMemo(
    () => (ticket?.technicianId ? db.users.find((u) => u.id === ticket.technicianId) : null),
    [ticket, db.users],
  );

  if (error) {
    return (
      <div className="page space-y-4">
        <BackLink />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading && !ticket) {
    return (
      <div className="page space-y-4">
        <BackLink />
        <Panel>
          <LoadingRows rows={6} />
        </Panel>
      </div>
    );
  }

  if (!ticket) return null;

  const aging = agingOf(ticket);
  /* The server keeps the balance (total − downpayment − payment ledger). */
  const owed = Math.max(0, ticket.balance);
  /* The header offers the stage's one next step, not the server's raw list.
     `released` is excluded from both: it needs a claimant and payment, so it
     goes through the release screen. */
  const stage = STAGE_META[stageOf(ticket.status)];
  const { primary, secondary } = stageActions(ticket);
  const primaryMove = primary && primary.to !== "released" ? primary : null;
  const releasable = stageOf(ticket.status) === "ready";

  const applyMove = async () => {
    if (!moveTo) return;
    setMoving(true);
    try {
      await api.setTicketStatus({
        ticketId: ticket.id,
        status: moveTo,
        actorId: user.id,
        note: note.trim() || undefined,
      });
      toast.success(`Moved to ${moveLabel(moveTo).toLowerCase()}.`);
      setMoveTo(null);
      setNote("");
      refetch();
    } catch (caught) {
      const { message, description } = toastError(caught, "Could not move the ticket.");
      toast.error(message, { description });
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="page space-y-4 sm:space-y-5">
      <BackLink />

      <TagHead
        ticketNo={ticket.ticketNo}
        claimCode={ticket.claimCode}
        aging={aging}
        title={customer?.name ?? "Walk-in"}
        subtitle={`${ticket.device.brand} ${ticket.device.model}${
          ticket.device.color ? ` · ${ticket.device.color}` : ""
        }`}
        meta={[
          { label: "Stage", value: stage.label },
          { label: "Promised", value: formatDate(ticket.promisedAt) },
          { label: "Owed", value: peso(owed) },
          {
            label: "Technician",
            value: technician?.name ?? "Unassigned",
          },
        ]}
        actions={
          <>
            {secondary.length ? (
              <Select value="" onValueChange={(v) => setMoveTo(v as TicketStatus)}>
                <SelectTrigger size="sm" className="w-auto min-w-36">
                  <ArrowRightLeft className="size-3.5" aria-hidden />
                  <SelectValue placeholder="Something else…" />
                </SelectTrigger>
                <SelectContent>
                  {secondary.map((move) => (
                    <SelectItem key={move.to} value={move.to}>
                      {move.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {/* One primary step per stage — the whole point of the fold. */}
            {primaryMove ? (
              <Button size="sm" onClick={() => setMoveTo(primaryMove.to)}>
                <ArrowRightLeft aria-hidden /> {primaryMove.label}
              </Button>
            ) : null}

            {releasable ? (
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/release?code=${encodeURIComponent(ticket.ticketNo)}`)
                }
              >
                <PackageOpen aria-hidden /> Release unit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] sm:gap-5">
        <div className="space-y-4 sm:space-y-5">
          <FindingPanel
            ticket={ticket}
            finding={finding}
            readOnly={ticket.status === "released"}
            onSaved={(next) => {
              setLocalFinding(next);
              refetchFinding();
              refetch();
            }}
          />

          <Panel>
            <PanelHeader>
              <PanelTitle>Reported problem</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <p className="text-sm leading-relaxed text-ink">
                {ticket.reportedProblem || "—"}
              </p>
              {ticket.problemTags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {ticket.problemTags.map((tag) => (
                    <Badge key={tag} variant="tint">
                      {PROBLEM_LABEL[tag] ?? tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Condition at intake</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label-pad mb-2">Turned over with the unit</p>
                {ticket.turnedOver.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.turnedOver.map((item) => (
                      <Badge key={item} variant="tint">
                        {TURNED_OVER_LABEL[item] ?? item}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">Nothing logged.</p>
                )}
              </div>
              <div>
                <p className="label-pad mb-2">Condition checklist</p>
                {ticket.conditionChecks.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.conditionChecks.map((item) => (
                      <Badge key={item} variant="outline">
                        {CONDITION_LABEL[item] ?? item}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">Nothing logged.</p>
                )}
              </div>
            </PanelBody>
          </Panel>

          {ticket.partsUsed.length ? (
            <Panel>
              <PanelHeader>
                <Wrench className="size-3.5 text-ink-faint" aria-hidden />
                <PanelTitle>Parts used</PanelTitle>
              </PanelHeader>
              <ul className="divide-y divide-rule-soft">
                {ticket.partsUsed.map((part) => (
                  <li
                    key={part.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm sm:px-4"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{part.name}</span>
                    <span className="mono text-xs text-ink-faint">×{part.quantity}</span>
                    <span className="mono w-24 text-right text-ink">
                      {peso(part.unitPrice * part.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>Device</PanelTitle>
            </PanelHeader>
            <dl className="divide-y divide-rule-soft">
              <Row label="Brand" value={ticket.device.brand} />
              <Row label="Model" value={ticket.device.model} />
              <Row label="Colour" value={ticket.device.color || "—"} />
              <Row
                label={
                  ticket.device.imei.replace(/\D/g, "").length === 15 ? "IMEI" : "Serial"
                }
                value={ticket.device.imei ? formatImei(ticket.device.imei) : "—"}
                mono
              />
              {ticket.device.unlockMethod !== "none" ? (
                <Row
                  label="Unlock"
                  value={`${ticket.device.unlockMethod}: ${ticket.device.unlockValue ?? "—"}`}
                  mono
                />
              ) : null}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader>
              <Banknote className="size-3.5 text-ink-faint" aria-hidden />
              <PanelTitle>Money</PanelTitle>
            </PanelHeader>
            <dl className="divide-y divide-rule-soft">
              <Row label="Estimate" value={peso(ticket.estimatedCost)} mono />
              <Row label="Total due" value={peso(ticket.totalDue)} mono />
              <Row label="Paid" value={peso(ticket.amountPaid)} mono />
              <Row label="Still owed" value={peso(owed)} mono alert={owed > 0} />
            </dl>
            <PanelBody className="border-t border-rule">
              <Button
                variant={owed > 0 ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setPaying(true)}
              >
                <Banknote aria-hidden />
                {owed > 0 ? `Take payment · ${peso(owed)}` : "Record a payment"}
              </Button>
              {/* The server keeps its own balance; when it disagrees with the
                  job's arithmetic, say so rather than quietly trusting one. */}
              {Math.abs(ticket.balance - owed) > 0.01 ? (
                <p className="mt-2 text-xs leading-relaxed text-flag-ink">
                  The server records a balance of {peso(ticket.balance)} on this
                  job, which does not match {peso(ticket.totalDue)} due less{" "}
                  {peso(ticket.amountPaid)} paid.
                </p>
              ) : null}
            </PanelBody>
          </Panel>

          {customer ? (
            <Panel>
              <PanelHeader>
                <PanelTitle>Customer</PanelTitle>
              </PanelHeader>
              <PanelBody className="space-y-1">
                <p className="text-sm font-medium text-ink">{customer.name}</p>
                <p className="mono text-xs text-ink-soft">
                  {formatMobile(customer.mobile)}
                </p>
                <Button asChild variant="ghost" size="xs" className="mt-1 -ml-2">
                  <Link href="/customers">View history</Link>
                </Button>
              </PanelBody>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader>
              <History className="size-3.5 text-ink-faint" aria-hidden />
              <PanelTitle>Timeline</PanelTitle>
            </PanelHeader>
            {timeline?.length ? (
              <ul className="max-h-96 divide-y divide-rule-soft overflow-y-auto">
                {timeline.map((event) => (
                  <li key={event.id} className="px-3 py-2 sm:px-4">
                    <p className="text-sm leading-snug text-ink">{event.message}</p>
                    <p className="mono mt-0.5 text-[0.6875rem] text-ink-faint">
                      {formatDateTime(event.at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={History}
                title="Nothing logged yet."
                body="Status changes and payments appear here as they happen."
              />
            )}
          </Panel>
        </div>
      </div>

      <PaymentDialog
        ticket={ticket}
        open={paying}
        onOpenChange={setPaying}
        onRecorded={refetch}
      />

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
              Move {ticket.ticketNo} to{" "}
              {moveTo ? moveLabel(moveTo).toLowerCase() : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="detail-note">Note (optional)</Label>
              <Textarea
                id="detail-note"
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

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/board">
        <ArrowLeft aria-hidden /> Repair board
      </Link>
    </Button>
  );
}

function Row({
  label,
  value,
  mono,
  alert,
}: {
  label: string;
  value: string;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2 sm:px-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          mono && "mono",
          alert ? "text-stamp-ink" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
