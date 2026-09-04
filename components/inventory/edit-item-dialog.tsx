"use client";

import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
import type { InventoryItem } from "@/lib/types";

/**
 * Editing a catalog row — name, SKU, barcode, category, brand, the two
 * prices, the reorder point, the default sale-warranty term, and whether it
 * still shows in the pickers.
 *
 * Not a stock movement: quantity and units are only ever changed by
 * receiving and adjustment. The item class is fixed once it has stock, so
 * it isn't offered here.
 */
const NONE = "__none__";

export function EditItemDialog({
  item,
  onOpenChange,
  onSaved,
}: {
  /** The row being edited; `null` keeps the dialog closed. */
  item: InventoryItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { api } = useShop();
  const { data: refs } = useQuery((client) => client.getProductRefs());

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [warrantyDays, setWarrantyDays] = useState("0");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  /* Refill every time a different row is opened. Category and brand come
     through as names on the item, so match them back to a ref id. */
  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setSku(item.sku);
    setBarcode(item.barcode ?? "");
    setCost(item.unitCost ? String(item.unitCost) : "");
    setPrice(item.sellingPrice ? String(item.sellingPrice) : "");
    setReorderPoint(String(item.reorderPoint ?? 0));
    setWarrantyDays(String(item.warrantyDays ?? 0));
    setActive(item.active);
  }, [item]);

  useEffect(() => {
    if (!item || !refs) return;
    setCategoryId(
      refs.categories.find((row) => row.name === item.category)?.id ?? "",
    );
    setBrandId(refs.brands.find((row) => row.name === item.brand)?.id ?? "");
  }, [item, refs]);

  const costValue = Number.parseFloat(cost || "0");
  const priceValue = Number.parseFloat(price || "0");
  const margin = priceValue > 0 ? priceValue - costValue : 0;

  const valid =
    name.trim().length > 1 &&
    sku.trim().length > 0 &&
    Boolean(categoryId) &&
    Number.isFinite(priceValue) &&
    priceValue >= 0;

  const submit = async () => {
    if (!item || !valid) return;
    setSaving(true);
    try {
      const saved = await api.updateItem({
        itemId: item.id,
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || null,
        categoryId,
        brandId: brandId || null,
        unitCost: money(costValue || 0),
        sellingPrice: money(priceValue),
        reorderPoint: Number.parseInt(reorderPoint || "0", 10) || 0,
        warrantyDays: Number.parseInt(warrantyDays || "0", 10) || 0,
        active,
      });
      toast.success(`${saved.name} updated.`);
      onOpenChange(false);
      onSaved?.();
    } catch (caught) {
      const { message, description } = toastError(
        caught,
        "Could not save the changes.",
      );
      toast.error(message, { description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="size-4 text-ink-faint" aria-hidden />
            Edit item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-item-name" className="label-pad">
                Name
              </Label>
              <Input
                id="edit-item-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-sku" className="label-pad">
                SKU
              </Label>
              <InputMono
                id="edit-item-sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-barcode" className="label-pad">
                Barcode (optional)
              </Label>
              <InputMono
                id="edit-item-barcode"
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
              <Select
                value={brandId || NONE}
                onValueChange={(v) => setBrandId(v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No brand</SelectItem>
                  {(refs?.brands ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-cost" className="label-pad">
                Cost
              </Label>
              <InputMono
                id="edit-item-cost"
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-price" className="label-pad">
                Selling price
              </Label>
              <InputMono
                id="edit-item-price"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-reorder" className="label-pad">
                Reorder point
              </Label>
              <InputMono
                id="edit-item-reorder"
                inputMode="numeric"
                value={reorderPoint}
                onChange={(event) => setReorderPoint(event.target.value)}
              />
              <p className="text-xs text-ink-soft">Flags as low at or below this.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-item-warranty" className="label-pad">
                Warranty days
              </Label>
              <InputMono
                id="edit-item-warranty"
                inputMode="numeric"
                value={warrantyDays}
                onChange={(event) => setWarrantyDays(event.target.value)}
              />
              <p className="text-xs text-ink-soft">
                Default term of the warranty issued when a unit sells. 0 = none.
              </p>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-md border border-rule bg-paper px-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Active</span>
              <span className="block text-xs text-ink-soft">
                Off keeps its history but hides it from the intake and POS
                pickers.
              </span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>

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
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
