"use client";

import { useEffect, useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemClass } from "@/lib/types";

/**
 * Putting a new line in the catalog.
 *
 * Deliberately not a stock movement: this creates the *thing*, and receiving
 * puts quantity against it. Handsets are created serialized, so their stock
 * arrives one IMEI at a time; everything else counts on a shelf.
 */

const CLASS_LABEL: Record<ItemClass, string> = {
  handset: "Handset",
  accessory: "Accessory",
  spare_part: "Spare part",
};

/** The category the shop already keeps for each class, matched by name. */
const CLASS_CATEGORY: Record<ItemClass, RegExp> = {
  handset: /handset|phone/i,
  accessory: /accessor/i,
  spare_part: /part/i,
};

export function NewItemDialog({
  open,
  onOpenChange,
  itemClass,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Defaults to the tab the user is looking at. */
  itemClass: ItemClass;
  onCreated?: () => void;
}) {
  const { api } = useShop();
  const { data: refs } = useQuery((client) => client.getProductRefs());

  const [kind, setKind] = useState<ItemClass>(itemClass);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [reorderPoint, setReorderPoint] = useState("2");
  const [saving, setSaving] = useState(false);

  /* Follow the tab whenever the dialog is opened from a different one. */
  useEffect(() => {
    if (open) setKind(itemClass);
  }, [open, itemClass]);

  const suggestedCategory = useMemo(
    () => refs?.categories.find((row) => CLASS_CATEGORY[kind].test(row.name)),
    [refs, kind],
  );

  /* Pre-pick the matching category so the common case is one less decision. */
  useEffect(() => {
    if (suggestedCategory) setCategoryId(suggestedCategory.id);
  }, [suggestedCategory]);

  const costValue = Number.parseFloat(cost || "0");
  const priceValue = Number.parseFloat(price || "0");
  const margin = priceValue > 0 ? priceValue - costValue : 0;

  const valid =
    name.trim().length > 1 &&
    sku.trim().length > 0 &&
    categoryId &&
    Number.isFinite(priceValue) &&
    priceValue >= 0;

  const reset = () => {
    setName("");
    setSku("");
    setBrandId("");
    setBarcode("");
    setCost("");
    setPrice("");
    setReorderPoint("2");
  };

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const created = await api.createItem({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        itemClass: kind,
        categoryId,
        brandId: brandId || undefined,
        barcode: barcode.trim() || undefined,
        unitCost: money(costValue || 0),
        sellingPrice: money(priceValue),
        reorderPoint: Number.parseInt(reorderPoint || "0", 10) || 0,
      });
      toast.success(`${created.name} added.`, {
        description:
          kind === "handset"
            ? "Receive units against it to put IMEIs in stock."
            : "Receive stock against it to put quantity on the shelf.",
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (caught) {
      const { message, description } = toastError(caught, "Could not add the item.");
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-4 text-ink-faint" aria-hidden />
            New item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="label-pad">Kind</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(CLASS_LABEL) as ItemClass[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setKind(entry)}
                  aria-pressed={kind === entry}
                  className={cn(
                    "tap rounded-md border px-2.5 text-xs transition-colors",
                    kind === entry
                      ? "border-bench bg-bench-fill font-semibold text-bench-ink"
                      : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                  )}
                >
                  {CLASS_LABEL[entry]}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-ink-soft">
              {kind === "handset"
                ? "Tracked one IMEI at a time. Stock arrives as individual units."
                : "Counted by quantity on the shelf."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="item-name" className="label-pad">
                Name
              </Label>
              <Input
                id="item-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  kind === "handset" ? "Samsung Galaxy A15" : "Tempered glass 9H"
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-sku" className="label-pad">
                SKU
              </Label>
              <InputMono
                id="item-sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="SAM-A15-001"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-barcode" className="label-pad">
                Barcode (optional)
              </Label>
              <InputMono
                id="item-barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan or type"
              />
            </div>

            <div className="space-y-1.5">
              <p className="label-pad">Category</p>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {(refs?.categories ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="label-pad">Brand (optional)</p>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  {(refs?.brands ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-cost" className="label-pad">
                Cost
              </Label>
              <InputMono
                id="item-cost"
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-price" className="label-pad">
                Selling price
              </Label>
              <InputMono
                id="item-price"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-reorder" className="label-pad">
                Reorder point
              </Label>
              <InputMono
                id="item-reorder"
                inputMode="numeric"
                value={reorderPoint}
                onChange={(event) => setReorderPoint(event.target.value)}
              />
              <p className="text-xs text-ink-soft">Flags as low at or below this.</p>
            </div>
          </div>

          {margin > 0 ? (
            <p className="mono text-xs text-ink-soft">
              Margin {money(margin).toLocaleString("en-PH")} per unit
            </p>
          ) : null}
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? "Adding…" : "Add item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
