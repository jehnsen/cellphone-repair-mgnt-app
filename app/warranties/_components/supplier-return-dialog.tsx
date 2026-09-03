"use client";

import { useMemo, useState } from "react";
import { Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useMutation, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { formatImei } from "@/lib/format";
import { SUPPLIER_RETURN_REASONS } from "@/lib/warranty";
import { cn } from "@/lib/utils";
import type { SupplierReturn, SupplierReturnReason, WarrantyUnitRef } from "@/lib/types";

/**
 * Ship a serialized unit back to its vendor.
 *
 * Two ways in: standalone from the Supplier returns list (pick the unit),
 * or prefilled from a warranty claim (`presetUnit` + `claimId` fixed, so
 * only the supplier and reason are left to choose).
 */

const RETURNABLE: WarrantyUnitRef["status"][] = ["in_stock", "sold", "for_repair"];

export function SupplierReturnDialog({
  claimId,
  presetUnit,
  defaultReason,
  onClose,
  onCreated,
}: {
  claimId?: string;
  presetUnit?: WarrantyUnitRef;
  defaultReason?: SupplierReturnReason;
  onClose: () => void;
  onCreated: (created: SupplierReturn) => void;
}) {
  const { db } = useShop();
  const create = useMutation((api, input: Parameters<typeof api.createSupplierReturn>[0]) =>
    api.createSupplierReturn(input),
  );

  const [unitSearch, setUnitSearch] = useState("");
  const [unitId, setUnitId] = useState(presetUnit?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState<SupplierReturnReason>(
    defaultReason ?? "factory_defect",
  );
  const [note, setNote] = useState("");

  const suppliers = useMemo(
    () => [...db.suppliers].filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name)),
    [db.suppliers],
  );

  /* The picker only reaches units the inventory cache carries (serialized
     handset stock). A claim-driven return skips this entirely. */
  const unitMatches = useMemo(() => {
    const needle = unitSearch.trim().toLowerCase();
    if (presetUnit || needle.length < 2) return [];
    const rows: { id: string; label: string; sub: string; status: string }[] = [];
    for (const item of db.items) {
      for (const unit of item.units ?? []) {
        const hay = `${item.name} ${unit.imei} ${item.sku}`.toLowerCase();
        if (!hay.includes(needle)) continue;
        rows.push({
          id: unit.id,
          label: item.name,
          sub: unit.imei ? formatImei(unit.imei) : unit.id,
          status: unit.status,
        });
        if (rows.length >= 8) return rows;
      }
    }
    return rows;
  }, [db.items, unitSearch, presetUnit]);

  const pickedStatus =
    presetUnit?.status ??
    (unitId
      ? db.items.flatMap((i) => i.units ?? []).find((u) => u.id === unitId)?.status
      : undefined);
  const notReturnable =
    pickedStatus !== undefined &&
    !RETURNABLE.includes(pickedStatus as WarrantyUnitRef["status"]);

  const canSave =
    unitId.length > 0 &&
    supplierId.length > 0 &&
    !notReturnable &&
    !create.pending;

  const submit = async () => {
    if (!canSave) return;
    const { data: result, error } = await create.mutate({
      serializedUnitId: unitId,
      supplierId,
      reason,
      reasonNote: note.trim() || undefined,
      saleWarrantyClaimId: claimId,
    });
    if (result) {
      toast.success(`Unit sent back to ${result.supplier?.name ?? "the supplier"}.`);
      onCreated(result);
      onClose();
    } else if (error) {
      const { message, description } = toastError(
        error,
        "Could not create the supplier return.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-4 text-ink-faint" aria-hidden />
            Send a unit back to a supplier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {presetUnit ? (
            <div className="rounded-sm border border-rule bg-paper px-3 py-2 text-sm">
              <p className="label-pad">Unit</p>
              <p className="mt-0.5 text-ink">{presetUnit.productName}</p>
              <p className="mono text-xs text-ink-faint">
                {presetUnit.imei
                  ? formatImei(presetUnit.imei)
                  : presetUnit.serialNumber || presetUnit.id}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sr-unit">Unit</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
                  aria-hidden
                />
                <Input
                  id="sr-unit"
                  value={unitSearch}
                  onChange={(e) => {
                    setUnitSearch(e.target.value);
                    setUnitId("");
                  }}
                  placeholder="Product name, SKU, or IMEI"
                  className="pl-8"
                  autoFocus
                />
              </div>
              {unitId ? (
                <p className="mono text-xs text-bench-ink">Unit selected.</p>
              ) : unitMatches.length ? (
                <ul className="divide-y divide-rule-soft rounded-sm border border-rule">
                  {unitMatches.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setUnitId(match.id);
                          setUnitSearch(`${match.label} — ${match.sub}`);
                        }}
                        className="tap flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {match.label}
                        </span>
                        <span className="mono text-xs text-ink-faint">{match.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : unitSearch.trim().length >= 2 ? (
                <p className="text-xs text-ink-faint">
                  No serialized unit in the cache matches. Open the return from the
                  customer&rsquo;s warranty claim instead.
                </p>
              ) : null}
            </div>
          )}

          {notReturnable ? (
            <p className="rounded-sm border border-flag/40 bg-flag-fill px-2.5 py-2 text-xs text-flag-ink">
              This unit is {pickedStatus?.replace(/_/g, " ")}. Only a unit in stock,
              sold, or on the repair bench can be sent back to a supplier.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select
                value={reason}
                onValueChange={(v) => setReason(v as SupplierReturnReason)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_RETURN_REASONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sr-note">Note (optional)</Label>
            <Textarea
              id="sr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Dead pixels out of the box, …"
            />
          </div>

          <div className={cn("flex justify-end gap-2 pt-1")}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {create.pending ? "Sending…" : "Send back"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
