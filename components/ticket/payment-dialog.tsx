"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { money, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod, Ticket } from "@/lib/types";

/**
 * Taking money against a repair, at any point in the job.
 *
 * A downpayment at intake is only the common case — customers pay halfway
 * through, or top up when the quote moves. Without this the only place to
 * record money was the release screen, so a job that had been paid for was
 * still showing a balance, and one that had not could be released for free.
 */

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
];

export function PaymentDialog({
  ticket,
  open,
  onOpenChange,
  onRecorded,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}) {
  const { api, user } = useShop();

  /* What the shop is owed, from the job's own arithmetic. */
  const owed = money(Math.max(0, ticket.totalDue - ticket.amountPaid));

  const [amount, setAmount] = useState(owed ? String(owed) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [tendered, setTendered] = useState("");
  const [saving, setSaving] = useState(false);

  const value = Number.parseFloat(amount || "0");
  const cash = Number.parseFloat(tendered || "0");
  const change = method === "cash" && cash > value ? money(cash - value) : 0;
  const needsReference = method !== "cash";
  const valid =
    Number.isFinite(value) && value > 0 && (!needsReference || reference.trim());

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.recordPayment({
        ticketId: ticket.id,
        amount: money(value),
        method,
        reference: reference.trim() || undefined,
        tendered: method === "cash" && cash > 0 ? money(cash) : undefined,
        actorId: user.id,
      });
      toast.success(`Recorded ${peso(money(value))}.`, {
        description: change > 0 ? `Change due: ${peso(change)}` : undefined,
      });
      onOpenChange(false);
      onRecorded?.();
    } catch (caught) {
      const { message, description } = toastError(
        caught,
        "Could not record the payment.",
      );
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-4 text-ink-faint" aria-hidden />
            Record a payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="rounded-sm border border-rule bg-paper px-3 py-2 text-sm">
            <Row label="Job total" value={peso(ticket.totalDue)} />
            <Row label="Already paid" value={peso(ticket.amountPaid)} />
            <Row label="Still owed" value={peso(owed)} strong />
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount" className="label-pad">
              Amount
            </Label>
            <InputMono
              id="pay-amount"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
            {owed > 0 && value !== owed ? (
              <button
                type="button"
                onClick={() => setAmount(String(owed))}
                className="text-xs text-bench-ink hover:underline"
              >
                Pay the full {peso(owed)}
              </button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <p className="label-pad">Method</p>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setMethod(entry.value)}
                  aria-pressed={method === entry.value}
                  className={cn(
                    "tap rounded-md border px-2.5 text-xs transition-colors",
                    method === entry.value
                      ? "border-bench bg-bench-fill font-semibold text-bench-ink"
                      : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          {method === "cash" ? (
            <div className="space-y-1.5">
              <Label htmlFor="pay-tendered" className="label-pad">
                Cash received (optional)
              </Label>
              <InputMono
                id="pay-tendered"
                inputMode="decimal"
                value={tendered}
                onChange={(event) => setTendered(event.target.value)}
                placeholder="0.00"
              />
              {change > 0 ? (
                <p className="mono text-sm font-semibold text-bench-ink">
                  Change {peso(change)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pay-reference" className="label-pad">
                Reference number
              </Label>
              <Input
                id="pay-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="GCash / bank reference"
              />
            </div>
          )}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? "Recording…" : `Record ${value > 0 ? peso(money(value)) : "payment"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-ink-soft", strong && "font-medium text-ink")}>{label}</dt>
      <dd className={cn("mono text-ink", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
