"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { formatDate, formatDateTime, peso } from "@/lib/format";
import {
  humanizeWarrantyEnum,
  SUPPLIER_RETURN_OUTCOMES,
} from "@/lib/warranty";
import type { HandsetCondition, SupplierReturnOutcome } from "@/lib/types";
import {
  BackLink,
  InfoRow,
  SupplierReturnStatusBadge,
  unitIdentifier,
} from "../../_components/warranty-ui";

export function SupplierReturnView({ ulid }: { ulid: string }) {
  const { can } = useShop();
  const showCost = can("margin.view");
  const mayManage = can("supplier_returns.manage");
  const [closing, setClosing] = useState(false);

  const { data: ret, loading, error, refetch } = useQuery(
    (api) => api.getSupplierReturn(ulid),
    [ulid],
  );

  const isSent = ret?.status === "sent";

  return (
    <div className="page space-y-4 sm:space-y-5">
      <BackLink href="/warranties?tab=returns" label="Supplier returns" />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading || !ret ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <PageHeader
            eyebrow="Supplier return"
            title={ret.sentAt ? `Sent ${formatDate(ret.sentAt)}` : "Supplier return"}
            actions={
              isSent && mayManage ? (
                <Button onClick={() => setClosing(true)}>
                  <PackageCheck aria-hidden /> Close return
                </Button>
              ) : undefined
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <SupplierReturnStatusBadge status={ret.status} />
            <Badge variant="outline">{humanizeWarrantyEnum(ret.reason)}</Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
            <Panel>
              <PanelHeader>
                <Undo2 className="size-3.5 text-ink-faint" aria-hidden />
                <PanelTitle>Return</PanelTitle>
              </PanelHeader>
              <div className="divide-y divide-rule-soft">
                <InfoRow label="Supplier">{ret.supplier?.name ?? "—"}</InfoRow>
                <InfoRow label="Reason">
                  {humanizeWarrantyEnum(ret.reason)}
                </InfoRow>
                {ret.reasonNote ? (
                  <InfoRow label="Note">{ret.reasonNote}</InfoRow>
                ) : null}
                <InfoRow label="Sent">
                  {ret.sentAt ? formatDate(ret.sentAt) : "—"}
                </InfoRow>
                {ret.resolvedAt ? (
                  <InfoRow label="Closed">
                    {formatDateTime(ret.resolvedAt)}
                  </InfoRow>
                ) : null}
                {showCost && ret.creditAmount != null ? (
                  <InfoRow label="Credit">
                    <span className="mono">{peso(ret.creditAmount)}</span>
                  </InfoRow>
                ) : null}
                {ret.replacementUnit ? (
                  <InfoRow label="Replacement">
                    <span className="mono text-xs">
                      {unitIdentifier(ret.replacementUnit)}
                    </span>
                  </InfoRow>
                ) : null}
                <InfoRow label="Warranty claim">
                  {ret.saleWarrantyClaimId ? (
                    <Link
                      href={`/warranties/claims/${ret.saleWarrantyClaimId}`}
                      className="text-xs text-bench-ink hover:underline"
                    >
                      View the claim
                    </Link>
                  ) : (
                    "—"
                  )}
                </InfoRow>
              </div>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Unit</PanelTitle>
              </PanelHeader>
              <div className="divide-y divide-rule-soft">
                <InfoRow label="Product">{ret.unit?.productName ?? "—"}</InfoRow>
                <InfoRow label="IMEI / serial">
                  <span className="mono text-xs">{unitIdentifier(ret.unit)}</span>
                </InfoRow>
                <InfoRow label="Condition">
                  {humanizeWarrantyEnum(ret.unit?.condition)}
                </InfoRow>
                <InfoRow label="Unit status">
                  {humanizeWarrantyEnum(ret.unit?.status)}
                </InfoRow>
              </div>
            </Panel>
          </div>

          {!isSent ? (
            <PanelBody className="rounded-sm border border-rule bg-copy text-sm text-ink-soft">
              This return is {ret.status}. Closed returns are read-only.
            </PanelBody>
          ) : null}
        </>
      )}

      {closing && ret ? (
        <CloseReturnDialog
          returnId={ret.id}
          hasClaim={Boolean(ret.saleWarrantyClaimId)}
          showCost={showCost}
          onClose={() => setClosing(false)}
        />
      ) : null}
    </div>
  );
}

/* ── Close ───────────────────────────────────────────────────────────── */

const CONDITIONS: { value: HandsetCondition; label: string }[] = [
  { value: "brand_new", label: "Brand new" },
  { value: "open_box", label: "Open box" },
  { value: "refurbished", label: "Refurbished" },
  { value: "secondhand", label: "Secondhand" },
];

function CloseReturnDialog({
  returnId,
  hasClaim,
  showCost,
  onClose,
}: {
  returnId: string;
  hasClaim: boolean;
  showCost: boolean;
  onClose: () => void;
}) {
  const close = useMutation((api, input: Parameters<typeof api.closeSupplierReturn>[0]) =>
    api.closeSupplierReturn(input),
  );

  const [outcome, setOutcome] = useState<SupplierReturnOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");
  const [condition, setCondition] = useState<HandsetCondition>("brand_new");
  const [acqCost, setAcqCost] = useState("");
  const [credit, setCredit] = useState("");

  /* A caller without margin sight cannot enter a credit amount, so that
     outcome is not offered to them at all. */
  const outcomes = SUPPLIER_RETURN_OUTCOMES.filter(
    (option) => option.value !== "credited" || showCost,
  );

  const replacementOk = imei.trim().length > 0 || serial.trim().length > 0;
  const creditValue = Number.parseFloat(credit || "");

  const canSave =
    outcome !== "" &&
    !close.pending &&
    (outcome !== "replaced" || replacementOk) &&
    (outcome !== "credited" || (Number.isFinite(creditValue) && creditValue >= 0));

  const submit = async () => {
    if (outcome === "" || !canSave) return;
    const { data: result, error } = await close.mutate({
      returnId,
      outcome,
      outcomeNotes: notes.trim() || undefined,
      replacement:
        outcome === "replaced"
          ? {
              imei: imei.trim() || undefined,
              serialNumber: serial.trim() || undefined,
              condition,
              acquisitionCost:
                showCost && acqCost.trim() ? Number.parseFloat(acqCost) : undefined,
            }
          : undefined,
      creditAmount: outcome === "credited" ? creditValue : undefined,
    });
    if (result) {
      toast.success("Supplier return closed.");
      onClose();
    } else if (error) {
      const { message, description } = toastError(
        error,
        "Could not close the return.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4 text-ink-faint" aria-hidden />
            Close supplier return
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as SupplierReturnOutcome)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="What did the supplier do?" />
              </SelectTrigger>
              <SelectContent>
                {outcomes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {outcome === "replaced" ? (
            <div className="space-y-3 rounded-sm border border-rule bg-paper p-3">
              <p className="label-pad">Replacement unit</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rep-imei">IMEI</Label>
                  <InputMono
                    id="rep-imei"
                    inputMode="numeric"
                    value={imei}
                    onChange={(e) => setImei(e.target.value)}
                    placeholder="15 digits"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rep-serial">or Serial</Label>
                  <InputMono
                    id="rep-serial"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="Serial number"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select
                    value={condition}
                    onValueChange={(v) => setCondition(v as HandsetCondition)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {showCost ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="rep-cost">Acquisition cost</Label>
                    <InputMono
                      id="rep-cost"
                      inputMode="decimal"
                      value={acqCost}
                      onChange={(e) =>
                        setAcqCost(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      placeholder="0.00"
                    />
                  </div>
                ) : null}
              </div>
              {!replacementOk ? (
                <p className="text-xs text-ink-faint">
                  Enter the replacement&rsquo;s IMEI or serial number.
                </p>
              ) : null}
            </div>
          ) : null}

          {outcome === "credited" ? (
            <div className="space-y-1.5">
              <Label htmlFor="credit-amount">Credit amount</Label>
              <InputMono
                id="credit-amount"
                inputMode="decimal"
                value={credit}
                onChange={(e) => setCredit(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="close-notes">Notes (optional)</Label>
            <Textarea
              id="close-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={2}
            />
          </div>

          {hasClaim ? (
            <p className="text-xs text-ink-faint">
              Closing also resolves the linked warranty claim.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {close.pending ? "Closing…" : "Close return"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
