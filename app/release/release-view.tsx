"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  PackageCheck,
  Printer,
  ScanBarcode,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagHead } from "@/components/tag/tag-head";
import { StatusChip } from "@/components/tag/status-chip";
import { useMutation, useQuery, useShop } from "@/lib/mock/store";
import { agingOf, STATUS_META } from "@/lib/status";
import { formatDate, formatMobile, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, Ticket } from "@/lib/types";

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

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
];

export function ReleaseView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { db, user, api } = useShop();
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState(searchParams.get("code") ?? "");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<Error | null>(null);

  const [claimant, setClaimant] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [released, setReleased] = useState<Ticket | null>(null);

  const release = useMutation((api, args: Parameters<typeof api.releaseTicket>[0]) =>
    api.releaseTicket(args),
  );

  const { data: readyTickets } = useQuery((api) =>
    api.getTickets({ status: ["ready_for_pickup"] }),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runLookup = async (value: string) => {
    const needle = value.trim();
    if (!needle) return;
    setSearching(true);
    setSearchError(null);
    setTicket(null);
    try {
      const found = await api.findTicketByCode(needle);
      if (!found) {
        setSearchError(new Error(`No job order matches "${needle}".`));
      } else {
        setTicket(found);
        setClaimant((prev) => prev || "");
      }
    } catch (error) {
      setSearchError(error as Error);
    } finally {
      setSearching(false);
    }
  };

  /* Arriving with ?code= — from the board's Release action, or a scan
     shortcut — fills the box and looks the unit up without a keystroke.
     Keyed on the param so a second arrival with a different code re-runs;
     Next reuses this component across param changes. */
  const codeParam = searchParams.get("code");
  useEffect(() => {
    if (!codeParam) return;
    setTerm(codeParam);
    runLookup(codeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const customer = useMemo(
    () => (ticket ? db.customers.find((c) => c.id === ticket.customerId) : null),
    [ticket, db.customers],
  );

  const aging = ticket ? agingOf(ticket) : null;
  const statusMeta = ticket ? STATUS_META[ticket.status] : null;
  const alreadyReleased = ticket?.status === "released";
  const notReady = ticket && !alreadyReleased && ticket.status !== "ready_for_pickup";
  const balance = ticket ? Math.max(0, ticket.balance) : 0;

  const canRelease = Boolean(
    ticket && !alreadyReleased && claimant.trim().length > 0 && !release.pending,
  );

  const clear = () => {
    setTerm("");
    setTicket(null);
    setSearchError(null);
    setClaimant("");
    setPaymentReference("");
    setPaymentMethod("cash");
    /* Drop ?code= too, or the effect above re-fills the box on the next
       render and the counter cannot actually clear the screen. */
    if (codeParam) router.replace("/release");
    inputRef.current?.focus();
  };

  const submitRelease = async () => {
    if (!ticket) return;
    const result = await release.mutate({
      ticketId: ticket.id,
      releasedTo: claimant.trim(),
      payment:
        balance > 0
          ? { amount: balance, method: paymentMethod, reference: paymentReference.trim() || undefined }
          : undefined,
      actorId: user.id,
    });
    if (result) {
      setReleased(result);
      toast.success(`${result.ticketNo} released to ${result.releasedTo}.`);
    } else if (release.error) {
      toast.error(release.error.message);
    }
  };

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Counter"
        title="Release"
        description="Scan or type the claim code, verify the claimant and the unit, collect any balance, then release."
      />

      <Panel>
        <PanelBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(term);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <ScanBarcode
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <InputMono
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Claim code, ticket number, or IMEI"
                className="pl-9"
                aria-label="Claim code, ticket number, or IMEI"
              />
            </div>
            <Button type="submit" disabled={!term.trim() || searching}>
              {searching ? "Searching…" : "Find job order"}
            </Button>
            {ticket ? (
              <Button type="button" variant="ghost" onClick={clear}>
                <X aria-hidden /> Clear
              </Button>
            ) : null}
          </form>

          {readyTickets && readyTickets.length > 0 && !ticket ? (
            <p className="mt-3 text-xs text-ink-soft">
              {readyTickets.length} unit{readyTickets.length === 1 ? "" : "s"} waiting for
              pickup right now.
            </p>
          ) : null}
        </PanelBody>
      </Panel>

      {searchError ? <ErrorState error={searchError} /> : null}

      {!ticket && !searchError ? (
        <Panel>
          <EmptyState
            icon={PackageCheck}
            title="Nothing pulled up yet."
            body="Enter a claim code, job order number, or IMEI to find the unit."
          />
        </Panel>
      ) : null}

      {ticket ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] sm:gap-5">
          <div className="space-y-4 sm:space-y-5">
            <TagHead
              ticketNo={ticket.ticketNo}
              claimCode={ticket.claimCode}
              aging={aging ?? undefined}
              title={customer?.name ?? "Walk-in"}
              subtitle={`${ticket.device.brand} ${ticket.device.model} · ${ticket.device.color}`}
              meta={[
                { label: "Status", value: statusMeta?.label ?? "" },
                { label: "Promised", value: formatDate(ticket.promisedAt) },
                { label: "Balance", value: peso(ticket.balance) },
              ]}
            />

            {alreadyReleased ? (
              <div className="flex items-start gap-3 rounded-lg border border-rule bg-secondary px-3 py-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
                <div>
                  <p className="font-semibold text-ink">Already released.</p>
                  <p className="mt-0.5 text-ink-soft">
                    Released to {ticket.releasedTo ?? "—"} on{" "}
                    {ticket.releasedAt ? formatDate(ticket.releasedAt) : "—"}. Released tickets
                    are locked — file a warranty claim to open a new job.
                  </p>
                </div>
              </div>
            ) : notReady ? (
              <div className="flex items-start gap-3 rounded-lg border border-flag/40 bg-flag-fill px-3 py-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-flag-ink" aria-hidden />
                <div>
                  <p className="font-semibold text-flag-ink">
                    This unit is still {statusMeta?.label.toLowerCase()}.
                  </p>
                  <p className="mt-0.5 text-ink-soft">
                    It has not been marked ready for pickup. Confirm with the bench before
                    releasing it anyway.
                  </p>
                </div>
              </div>
            ) : null}

            <Panel>
              <PanelHeader>
                <PanelTitle>Condition at intake</PanelTitle>
              </PanelHeader>
              <PanelBody className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label-pad mb-2">Turned over with the unit</p>
                  {ticket.turnedOver.length === 0 ? (
                    <p className="text-sm text-ink-faint">Nothing logged.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.turnedOver.map((item) => (
                        <Badge key={item} variant="tint">
                          {TURNED_OVER_LABEL[item] ?? item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="label-pad mb-2">Condition checklist</p>
                  {ticket.conditionChecks.length === 0 ? (
                    <p className="text-sm text-ink-faint">Nothing logged.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.conditionChecks.map((item) => (
                        <Badge key={item} variant="outline">
                          {CONDITION_LABEL[item] ?? item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </PanelBody>
              <p className="border-t border-rule-soft px-3 py-2 text-xs leading-relaxed text-ink-soft sm:px-4">
                Compare this against the unit in hand before releasing it. Anything new — a
                fresh crack, a missing back cover — goes in a note on the ticket, not here.
              </p>
            </Panel>

            {ticket.reportedProblem ? (
              <Panel>
                <PanelHeader>
                  <PanelTitle>Reported problem</PanelTitle>
                </PanelHeader>
                <PanelBody>
                  <p className="text-sm leading-relaxed text-ink">{ticket.reportedProblem}</p>
                  {ticket.diagnosis ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      <span className="font-medium text-ink">Diagnosis: </span>
                      {ticket.diagnosis}
                    </p>
                  ) : null}
                </PanelBody>
              </Panel>
            ) : null}
          </div>

          {!alreadyReleased ? (
            <div className="space-y-4 sm:space-y-5">
              <Panel className="xl:sticky xl:top-16">
                <PanelHeader>
                  <PanelTitle>Release</PanelTitle>
                </PanelHeader>
                <PanelBody className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="claimant">Claimed by</Label>
                    <Input
                      id="claimant"
                      value={claimant}
                      onChange={(e) => setClaimant(e.target.value)}
                      placeholder={customer?.name ?? "Full name"}
                    />
                    {customer ? (
                      <button
                        type="button"
                        onClick={() => setClaimant(customer.name)}
                        className="text-xs text-bench-ink hover:underline"
                      >
                        Use {customer.name} ({formatMobile(customer.mobile)})
                      </button>
                    ) : null}
                  </div>

                  <div className="border-t border-rule-soft pt-3">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-ink-soft">Total due</span>
                      <span className="mono text-ink">{peso(ticket.totalDue)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between text-sm">
                      <span className="text-ink-soft">Already paid</span>
                      <span className="mono text-ink">{peso(ticket.amountPaid)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between text-sm font-semibold">
                      <span className="text-ink">Balance due now</span>
                      <span className={cn("mono", balance > 0 ? "text-stamp-ink" : "text-bench-ink")}>
                        {peso(balance)}
                      </span>
                    </div>
                  </div>

                  {balance > 0 ? (
                    <div className="space-y-1.5">
                      <Label>Payment method</Label>
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                        className="grid grid-cols-3 gap-2"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <label
                            key={m.value}
                            className={cn(
                              "tap flex cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                              paymentMethod === m.value
                                ? "border-bench bg-bench-fill text-bench-ink"
                                : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                            )}
                          >
                            <RadioGroupItem value={m.value} className="sr-only" />
                            {m.label}
                          </label>
                        ))}
                      </RadioGroup>
                      {paymentMethod !== "cash" ? (
                        <Input
                          className="mt-1.5"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Reference number"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={submitRelease}
                    disabled={!canRelease}
                  >
                    <PackageCheck aria-hidden />
                    {release.pending
                      ? "Releasing…"
                      : balance > 0
                        ? `Collect ${peso(balance)} and release`
                        : "Release unit"}
                  </Button>
                  {!claimant.trim() ? (
                    <p className="text-center text-xs text-ink-faint">
                      Enter who is claiming the unit to continue.
                    </p>
                  ) : null}
                </PanelBody>
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(released)} onOpenChange={(open) => !open && setReleased(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-bench" aria-hidden />
              Unit released
            </DialogTitle>
          </DialogHeader>

          {released ? (
            <div className="space-y-4">
              <TagHead
                ticketNo={released.ticketNo}
                claimCode={released.claimCode}
                title={released.releasedTo}
                subtitle={`${released.device.brand} ${released.device.model}`}
                meta={[
                  { label: "Released", value: formatDate(released.releasedAt ?? "") },
                  { label: "Amount paid", value: peso(released.amountPaid) },
                ]}
              />

              {released.warranty ? (
                <div className="rounded-lg border border-bench/30 bg-bench-fill p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-bench-ink" aria-hidden />
                    <p className="text-sm font-semibold text-bench-ink">
                      {released.warranty.periodDays}-day warranty
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    {released.warranty.scope} Valid until{" "}
                    {formatDate(released.warranty.expiresAt)}.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-faint">No warranty on this release.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer aria-hidden /> Print warranty slip
                </Button>
                <Button
                  className="ml-auto"
                  onClick={() => {
                    setReleased(null);
                    clear();
                  }}
                >
                  Next release
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
