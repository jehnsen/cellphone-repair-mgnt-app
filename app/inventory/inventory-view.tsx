"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelScroller } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TableNumeric,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { isLowStock, itemStock } from "@/lib/shop/queries";
import { formatDate, formatImei, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdjustStockInput,
  ReceiveStockInput,
} from "@/lib/shop/contract";
import type { HandsetCondition, InventoryItem, ItemClass } from "@/lib/types";

const CLASS_LABEL: Record<ItemClass, string> = {
  handset: "Handsets",
  accessory: "Accessories",
  spare_part: "Spare parts",
};

const CONDITION_LABEL: Record<HandsetCondition, string> = {
  brand_new: "Brand new",
  open_box: "Open box",
  secondhand: "Secondhand",
  refurbished: "Refurbished",
};

const ADJUST_REASONS: { value: AdjustStockInput["reason"]; label: string }[] = [
  { value: "count_correction", label: "Count correction" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "return_supplier", label: "Returned to supplier" },
  { value: "return_customer", label: "Returned by customer" },
];

const DEAD_STOCK_DAYS = 60;

export function InventoryView() {
  const { db, user } = useShop();

  const [itemClass, setItemClass] = useState<ItemClass>("handset");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "dead">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [receiving, setReceiving] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);

  const { data: items, loading, error, refetch } = useQuery((api) => api.getItems({}));
  const { data: suppliers } = useQuery((api) => api.getSuppliers());

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return (items ?? [])
      .filter((item) => item.itemClass === itemClass)
      .filter((item) => {
        if (filter === "low" && !isLowStock(db, item.id)) return false;
        if (filter === "dead") {
          const last = item.lastMovementAt ? new Date(item.lastMovementAt).getTime() : 0;
          if (now - last < DEAD_STOCK_DAYS * 86_400_000) return false;
        }
        if (!needle) return true;
        return [item.name, item.sku, item.brand, item.barcode ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, itemClass, filter, search, db]);

  const lowCount = useMemo(
    () => (items ?? []).filter((item) => isLowStock(db, item.id)).length,
    [items, db],
  );

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Shop"
        title="Inventory"
        description="Handsets are tracked one IMEI at a time. Accessories and spare parts move by quantity."
        actions={
          lowCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilter(filter === "low" ? "all" : "low")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "low"
                  ? "border-flag bg-flag-fill text-flag-ink"
                  : "border-rule bg-copy text-ink-soft hover:bg-secondary",
              )}
            >
              <TriangleAlert className="size-3.5" aria-hidden />
              {lowCount} low on stock
            </button>
          ) : null
        }
      />

      <Tabs value={itemClass} onValueChange={(v) => setItemClass(v as ItemClass)}>
        <TabsList>
          {(Object.keys(CLASS_LABEL) as ItemClass[]).map((value) => (
            <TabsTrigger key={value} value={value}>
              {CLASS_LABEL[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, SKU, or barcode"
            className="pl-8"
            aria-label="Search inventory"
          />
        </div>

        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger size="sm" className="w-auto min-w-36">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="dead">No movement in {DEAD_STOCK_DAYS}d</SelectItem>
          </SelectContent>
        </Select>

        <span className="mono ml-auto text-xs text-ink-faint">{rows.length} items</span>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      <Panel>
        {loading && !items ? (
          <LoadingRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nothing here."
            body={
              filter === "all"
                ? "No items in this class yet."
                : "No items match this filter. Clear it to see everything."
            }
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  {itemClass === "handset" ? <TableHead className="w-8" /> : null}
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Last movement</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const stock = itemStock(db, item.id);
                  const low = isLowStock(db, item.id);
                  const isOpen = expanded.has(item.id);
                  const units = (item.units ?? []).filter((u) => u.status === "in_stock");

                  return (
                    <Fragment key={item.id}>
                      <TableRow>
                        {itemClass === "handset" ? (
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              aria-label={isOpen ? "Collapse units" : "Expand units"}
                              aria-expanded={isOpen}
                              className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-secondary hover:text-ink"
                            >
                              {isOpen ? (
                                <ChevronDown className="size-4" aria-hidden />
                              ) : (
                                <ChevronRight className="size-4" aria-hidden />
                              )}
                            </button>
                          </TableCell>
                        ) : null}

                        <TableCell>
                          <p className="truncate font-medium text-ink">{item.name}</p>
                          <p className="truncate text-xs text-ink-soft">
                            {item.brand} · {item.category}
                          </p>
                        </TableCell>

                        <TableCell className="mono text-xs text-ink-soft">{item.sku}</TableCell>

                        <TableNumeric>
                          <span
                            className={cn(
                              "font-semibold",
                              low ? "text-flag-ink" : "text-ink",
                            )}
                          >
                            {stock}
                          </span>
                          {low ? (
                            <Badge variant="flag" className="ml-2">
                              low
                            </Badge>
                          ) : null}
                        </TableNumeric>

                        <TableNumeric className="text-ink-soft">
                          {peso(item.unitCost)}
                        </TableNumeric>
                        <TableNumeric>{peso(item.sellingPrice)}</TableNumeric>

                        <TableCell className="mono text-xs text-ink-faint">
                          {item.lastMovementAt ? formatDate(item.lastMovementAt) : "—"}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setReceiving(item)}
                            >
                              <PackagePlus aria-hidden /> Receive
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setAdjusting(item)}
                            >
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {itemClass === "handset" && isOpen ? (
                        <TableRow className="bg-paper/60">
                          <TableCell colSpan={8} className="p-0">
                            {units.length === 0 ? (
                              <p className="px-6 py-3 text-xs text-ink-faint">
                                No units in stock.
                              </p>
                            ) : (
                              <ul className="divide-y divide-rule-soft">
                                {units.map((unit) => (
                                  <li
                                    key={unit.id}
                                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2 text-xs"
                                  >
                                    <span className="mono font-medium text-ink">
                                      {formatImei(unit.imei)}
                                    </span>
                                    <Badge variant="outline">
                                      {CONDITION_LABEL[unit.condition]}
                                    </Badge>
                                    {unit.storage ? (
                                      <span className="text-ink-soft">{unit.storage}</span>
                                    ) : null}
                                    {unit.color ? (
                                      <span className="text-ink-soft">{unit.color}</span>
                                    ) : null}
                                    <span className="mono ml-auto text-ink-soft">
                                      {peso(unit.cost)} → {peso(unit.price)}
                                    </span>
                                    <span className="mono text-ink-faint">
                                      {formatDate(unit.receivedAt)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>

      {receiving ? (
        <ReceiveDialog
          item={receiving}
          suppliers={suppliers ?? []}
          userId={user.id}
          onClose={() => setReceiving(null)}
        />
      ) : null}

      {adjusting ? (
        <AdjustDialog
          item={adjusting}
          userId={user.id}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </div>
  );
}

/* ── Receive ─────────────────────────────────────────────────────────── */

interface UnitDraft {
  key: string;
  imei: string;
  condition: HandsetCondition;
  cost: string;
  price: string;
  storage: string;
  color: string;
}

function ReceiveDialog({
  item,
  suppliers,
  userId,
  onClose,
}: {
  item: InventoryItem;
  suppliers: { id: string; name: string }[];
  userId: string;
  onClose: () => void;
}) {
  const isHandset = item.itemClass === "handset";
  const receive = useMutation((api, input: ReceiveStockInput) => api.receiveStock(input));

  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState(String(item.unitCost));
  const [supplierId, setSupplierId] = useState(item.supplierId ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [units, setUnits] = useState<UnitDraft[]>([
    {
      key: "u1",
      imei: "",
      condition: "brand_new",
      cost: String(item.unitCost),
      price: String(item.sellingPrice),
      storage: "",
      color: "",
    },
  ]);

  const addUnit = () =>
    setUnits((prev) => [
      ...prev,
      {
        key: `u${prev.length + 1}-${Date.now()}`,
        imei: "",
        condition: "brand_new",
        cost: String(item.unitCost),
        price: String(item.sellingPrice),
        storage: "",
        color: "",
      },
    ]);

  const validUnits = units.filter((u) => u.imei.trim().length === 15);
  const canSubmit = isHandset
    ? validUnits.length > 0 && !receive.pending
    : Number(quantity) > 0 && !receive.pending;

  const submit = async () => {
    const result = await receive.mutate({
      itemId: item.id,
      quantity: isHandset ? undefined : Number(quantity),
      units: isHandset
        ? validUnits.map((u) => ({
            imei: u.imei.trim(),
            condition: u.condition,
            cost: Number(u.cost) || 0,
            price: Number(u.price) || 0,
            storage: u.storage.trim() || undefined,
            color: u.color.trim() || undefined,
            warrantyDays: u.condition === "brand_new" ? 365 : 30,
          }))
        : undefined,
      unitCost: isHandset ? undefined : Number(unitCost) || undefined,
      supplierId: supplierId || undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      userId,
    });

    if (result) {
      toast.success(
        isHandset
          ? `Received ${validUnits.length} unit${validUnits.length === 1 ? "" : "s"} of ${item.name}.`
          : `Received ${quantity} × ${item.name}.`,
      );
      onClose();
    } else if (receive.error) {
      toast.error(receive.error.message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive stock — {item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference">Delivery receipt no.</Label>
              <InputMono
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="DR-00000"
              />
            </div>
          </div>

          {isHandset ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Units — one row per IMEI</Label>
                <Button variant="outline" size="xs" onClick={addUnit}>
                  <Plus aria-hidden /> Add unit
                </Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {units.map((unit, index) => (
                  <div
                    key={unit.key}
                    className="grid gap-2 rounded-lg border border-rule p-2.5 sm:grid-cols-2"
                  >
                    <InputMono
                      value={unit.imei}
                      onChange={(e) =>
                        setUnits((prev) =>
                          prev.map((u) =>
                            u.key === unit.key
                              ? { ...u, imei: e.target.value.replace(/\D/g, "").slice(0, 15) }
                              : u,
                          )
                        )
                      }
                      placeholder="15-digit IMEI"
                      aria-label={`IMEI for unit ${index + 1}`}
                      aria-invalid={unit.imei.length > 0 && unit.imei.length !== 15}
                    />
                    <Select
                      value={unit.condition}
                      onValueChange={(v) =>
                        setUnits((prev) =>
                          prev.map((u) =>
                            u.key === unit.key ? { ...u, condition: v as HandsetCondition } : u,
                          )
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CONDITION_LABEL) as HandsetCondition[]).map((c) => (
                          <SelectItem key={c} value={c}>
                            {CONDITION_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <InputMono
                      value={unit.cost}
                      onChange={(e) =>
                        setUnits((prev) =>
                          prev.map((u) =>
                            u.key === unit.key
                              ? { ...u, cost: e.target.value.replace(/[^0-9.]/g, "") }
                              : u,
                          )
                        )
                      }
                      placeholder="Cost"
                      aria-label={`Cost for unit ${index + 1}`}
                    />
                    <InputMono
                      value={unit.price}
                      onChange={(e) =>
                        setUnits((prev) =>
                          prev.map((u) =>
                            u.key === unit.key
                              ? { ...u, price: e.target.value.replace(/[^0-9.]/g, "") }
                              : u,
                          )
                        )
                      }
                      placeholder="Selling price"
                      aria-label={`Price for unit ${index + 1}`}
                    />
                    <Input
                      value={unit.storage}
                      onChange={(e) =>
                        setUnits((prev) =>
                          prev.map((u) =>
                            u.key === unit.key ? { ...u, storage: e.target.value } : u,
                          )
                        )
                      }
                      placeholder="Storage (128GB)"
                      aria-label={`Storage for unit ${index + 1}`}
                    />
                    <div className="flex gap-2">
                      <Input
                        value={unit.color}
                        onChange={(e) =>
                          setUnits((prev) =>
                            prev.map((u) =>
                              u.key === unit.key ? { ...u, color: e.target.value } : u,
                            )
                          )
                        }
                        placeholder="Color"
                        aria-label={`Color for unit ${index + 1}`}
                      />
                      {units.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setUnits((prev) => prev.filter((u) => u.key !== unit.key))
                          }
                          aria-label={`Remove unit ${index + 1}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-faint">
                {validUnits.length} of {units.length} rows have a complete IMEI.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity received</Label>
                <InputMono
                  id="quantity"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit-cost">Unit cost</Label>
                <InputMono
                  id="unit-cost"
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="receive-note">Note (optional)</Label>
            <Textarea
              id="receive-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              <PackagePlus aria-hidden />
              {receive.pending ? "Receiving…" : "Receive stock"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Adjust ──────────────────────────────────────────────────────────── */

function AdjustDialog({
  item,
  userId,
  onClose,
}: {
  item: InventoryItem;
  userId: string;
  onClose: () => void;
}) {
  const isHandset = item.itemClass === "handset";
  const adjust = useMutation((api, input: AdjustStockInput) => api.adjustStock(input));

  const [quantity, setQuantity] = useState("-1");
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState<AdjustStockInput["reason"]>("count_correction");
  const [note, setNote] = useState("");

  const units = (item.units ?? []).filter((u) => u.status === "in_stock");
  const canSubmit =
    note.trim().length > 0 &&
    !adjust.pending &&
    (isHandset ? Boolean(unitId) : Number(quantity) !== 0);

  const submit = async () => {
    const result = await adjust.mutate({
      itemId: item.id,
      quantity: isHandset ? undefined : Number(quantity),
      unitId: isHandset ? unitId : undefined,
      unitStatus: isHandset ? (reason === "return_customer" ? "in_stock" : "returned") : undefined,
      reason,
      note: note.trim(),
      userId,
    });

    if (result) {
      toast.success(`Adjusted ${item.name}.`);
      onClose();
    } else if (adjust.error) {
      toast.error(adjust.error.message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isHandset ? (
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick an IMEI" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {formatImei(unit.imei)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {units.length === 0 ? (
                <p className="text-xs text-ink-faint">No units in stock to adjust.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="adjust-qty">
                Quantity change ({item.quantityOnHand} on hand)
              </Label>
              <InputMono
                id="adjust-qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^0-9-]/g, ""))}
                placeholder="-1"
              />
              <p className="text-xs text-ink-faint">
                Negative removes stock, positive adds it back.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as AdjustStockInput["reason"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUST_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-note">What happened (required)</Label>
            <Textarea
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Two units crushed in the stockroom."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {adjust.pending ? "Adjusting…" : "Record adjustment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
