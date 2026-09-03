"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { formatImei } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimHandling } from "@/lib/types";

/**
 * File a warranty claim. Filing never opens a job order — a `repair_board`
 * claim only pins an existing ticket for whoever does the bench work.
 */
export function FileClaimDialog({
  warrantyId,
  onClose,
}: {
  warrantyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { db } = useShop();
  const file = useMutation((api, input: Parameters<typeof api.fileWarrantyClaim>[0]) =>
    api.fileWarrantyClaim(input),
  );

  const [defect, setDefect] = useState("");
  const [handling, setHandling] = useState<ClaimHandling>("separate");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketId, setTicketId] = useState<string>("");

  const ticketMatches = useMemo(() => {
    const needle = ticketSearch.trim().toLowerCase();
    if (handling !== "repair_board" || ticketId || needle.length < 2) return [];
    return db.tickets
      .filter((ticket) =>
        [ticket.ticketNo, ticket.claimCode, ticket.device.imei]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 6);
  }, [db.tickets, ticketSearch, handling, ticketId]);

  const pickedTicket = ticketId
    ? db.tickets.find((ticket) => ticket.id === ticketId)
    : undefined;

  const canSave = defect.trim().length > 0 && !file.pending;

  const submit = async () => {
    if (!canSave) return;
    const { data: claim, error } = await file.mutate({
      warrantyId,
      reportedDefect: defect.trim(),
      handling,
      repairTicketId: handling === "repair_board" ? ticketId || undefined : undefined,
    });
    if (claim) {
      toast.success("Claim filed.", { description: "It stays under CP units — no job order was created." });
      onClose();
      router.push(`/warranties/claims/${claim.id}`);
    } else if (error) {
      const { message, description } = toastError(error, "Could not file the claim.");
      toast.error(message, { description });
    }
  };

  const options: { value: ClaimHandling; label: string; hint: string }[] = [
    {
      value: "separate",
      label: "Keep under CP units",
      hint: "The sales counter handles it end to end.",
    },
    {
      value: "repair_board",
      label: "Attach to a repair job order",
      hint: "Pin an existing ticket for the bench. Still no new job order.",
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-ink-faint" aria-hidden />
            File a warranty claim
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="claim-defect">Reported defect</Label>
            <Textarea
              id="claim-defect"
              value={defect}
              onChange={(e) => setDefect(e.target.value.slice(0, 2000))}
              rows={3}
              autoFocus
              placeholder="Screen flickers and the battery drains overnight."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Handling</Label>
            <RadioGroup
              value={handling}
              onValueChange={(v) => {
                setHandling(v as ClaimHandling);
                setTicketId("");
              }}
              className="gap-2"
            >
              {options.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`handling-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
                    handling === option.value
                      ? "border-bench bg-bench-fill"
                      : "border-rule hover:bg-secondary",
                  )}
                >
                  <RadioGroupItem
                    id={`handling-${option.value}`}
                    value={option.value}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {option.label}
                    </span>
                    <span className="block text-xs text-ink-soft">{option.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {handling === "repair_board" ? (
            <div className="space-y-1.5">
              <Label htmlFor="claim-ticket">Repair ticket (optional)</Label>
              {pickedTicket ? (
                <div className="flex items-center justify-between rounded-sm border border-rule bg-paper px-3 py-2 text-sm">
                  <span className="mono text-ink">{pickedTicket.ticketNo}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setTicketId("");
                      setTicketSearch("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
                      aria-hidden
                    />
                    <Input
                      id="claim-ticket"
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      placeholder="Ticket number, claim code, or IMEI"
                      className="pl-8"
                    />
                  </div>
                  {ticketMatches.length ? (
                    <ul className="divide-y divide-rule-soft rounded-sm border border-rule">
                      {ticketMatches.map((ticket) => (
                        <li key={ticket.id}>
                          <button
                            type="button"
                            onClick={() => setTicketId(ticket.id)}
                            className="tap flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
                          >
                            <span className="mono text-ink">{ticket.ticketNo}</span>
                            <span className="mono ml-auto text-xs text-ink-faint">
                              {ticket.device.imei
                                ? formatImei(ticket.device.imei)
                                : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <p className="text-xs text-ink-faint">
            Filing a claim does not create a job order.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {file.pending ? "Filing…" : "File claim"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
