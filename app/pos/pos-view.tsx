"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePercent,
  Banknote,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  Printer,
  Repeat,
  ScanBarcode,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { PrintDocument } from "@/components/print/print-document";
import { SaleReceipt } from "@/components/print/sale-receipt";
import { itemStock } from "@/lib/shop/queries";
import { computeTax } from "@/lib/vat";
import { money, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NewSaleInput } from "@/lib/shop/contract";
import type { InventoryItem, PaymentMethod, Sale, SaleLineKind } from "@/lib/types";

interface CartLine {
  key: string;
  kind: SaleLineKind;
  itemId?: string;
  unitId?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  /** Handsets and services are single-quantity by nature. */
  fixedQuantity: boolean;
  maxQuantity?: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank" },
];

export function PosView() {
  const { db, user } = useShop();
  const scanRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [seniorPwd, setSeniorPwd] = useState(false);
  const [seniorId, setSeniorId] = useState("");
  const [seniorName, setSeniorName] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  /* A traded-in handset comes in through the buy-back flow (create → IMEI
     check → complete); here we only spend a completed acquisition as tender. */
  const [tradeIn, setTradeIn] = useState(false);
  const [acquisitionId, setAcquisitionId] = useState("");
  const [tradeInValue, setTradeInValue] = useState("");
  /* 58mm and 80mm are the two rolls PH counter printers use. */
  const [rollWidth, setRollWidth] = useState<58 | 80>(80);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startingCash, setStartingCash] = useState("3000");

  const { data: openShift, refetch: refetchShift } = useQuery((api) => api.getOpenShift());
  const { data: items } = useQuery((api) => api.getItems({}));

  const createSale = useMutation((api, input: NewSaleInput) => api.createSale(input));
  const openShiftMut = useMutation((api, startingCashValue: number) =>
    api.openShift({ startingCash: startingCashValue, userId: user.id }),
  );

  useEffect(() => {
    scanRef.current?.focus();
  }, [openShift]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return (items ?? [])
      .filter((item) => {
        if (!item.active) return false;
        const haystack = [
          item.name,
          item.sku,
          item.brand,
          item.barcode ?? "",
          ...(item.units ?? []).map((u) => u.imei),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [items, term]);

  const addItem = (item: InventoryItem, imeiHint?: string) => {
    if (item.itemClass === "handset") {
      const units = (item.units ?? []).filter((u) => u.status === "in_stock");
      const unit = imeiHint
        ? units.find((u) => u.imei.includes(imeiHint.replace(/\D/g, "")))
        : units[0];
      if (!unit) {
        toast.error(`No ${item.name} units in stock.`);
        return;
      }
      if (cart.some((line) => line.unitId === unit.id)) {
        toast.error("That handset is already in the cart.");
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          key: unit.id,
          kind: "handset",
          itemId: item.id,
          unitId: unit.id,
          sku: item.sku,
          name: `${item.name} ${unit.storage ?? ""} (${unit.condition.replace(/_/g, " ")})`.trim(),
          quantity: 1,
          unitPrice: unit.price,
          unitCost: unit.cost,
          fixedQuantity: true,
        },
      ]);
    } else {
      const stock = itemStock(db, item.id);
      if (stock <= 0) {
        toast.error(`${item.name} is out of stock.`);
        return;
      }
      setCart((prev) => {
        const existing = prev.find((line) => line.itemId === item.id);
        if (existing) {
          if (existing.quantity >= stock) {
            toast.error(`Only ${stock} in stock.`);
            return prev;
          }
          return prev.map((line) =>
            line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }
        return [
          ...prev,
          {
            /* Anything that is not a serialized handset is still a *product*
               line — a spare part sold over the counter is stock leaving the
               shelf, not labour. Calling it a service sent the product's ULID
               as `service_ulid` and the server rejected it as invalid. */
            key: item.id,
            kind: "accessory",
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: 1,
            unitPrice: item.sellingPrice,
            unitCost: item.unitCost,
            fixedQuantity: false,
            maxQuantity: stock,
          },
        ];
      });
    }
    setTerm("");
    scanRef.current?.focus();
  };

  const addService = () => {
    const service = db.services.find((s) => s.active);
    if (!service) return;
    setCart((prev) => [
      ...prev,
      {
        key: `svc-${Date.now()}`,
        kind: "service",
        /* The service's own ULID: this is the only kind of line the server
           accepts as `service_ulid`, and without it the sale cannot be sent. */
        itemId: service.id,
        sku: service.code,
        name: service.name,
        quantity: 1,
        unitPrice: service.standardPrice,
        unitCost: 0,
        fixedQuantity: true,
      },
    ]);
  };

  const setQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.key !== key) return [line];
        const next = line.quantity + delta;
        if (next <= 0) return [];
        if (line.maxQuantity && next > line.maxQuantity) {
          toast.error(`Only ${line.maxQuantity} in stock.`);
          return [line];
        }
        return [{ ...line, quantity: next }];
      }),
    );
  };

  const removeLine = (key: string) =>
    setCart((prev) => prev.filter((line) => line.key !== key));

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  );

  const tax = useMemo(
    () =>
      computeTax({
        subtotal,
        seniorPwd: { applies: seniorPwd },
        vatRegistered: db.shop.vatRegistered,
        vatRate: db.shop.vatRate,
      }),
    [subtotal, seniorPwd, db.shop.vatRegistered, db.shop.vatRate],
  );

  /* Trade-in offsets the bill; it never over-pays and never gives change, so
     it is capped at the total. Any excess offered price is the buy-back's
     problem, not the sale's. */
  const tradeInAmount = tradeIn
    ? money(Math.min(Math.max(0, Number(tradeInValue) || 0), tax.totalDue))
    : 0;
  const remainingDue = money(Math.max(0, tax.totalDue - tradeInAmount));

  const tenderedValue = Number(tendered) || 0;
  const change = method === "cash" ? Math.max(0, tenderedValue - remainingDue) : 0;
  const shortBy = method === "cash" ? Math.max(0, remainingDue - tenderedValue) : 0;

  const tradeInReady = !tradeIn || (acquisitionId.trim().length > 0 && tradeInAmount > 0);

  const canCharge =
    cart.length > 0 &&
    !createSale.pending &&
    tradeInReady &&
    (remainingDue === 0 || method !== "cash" || tenderedValue >= remainingDue) &&
    (!seniorPwd || (seniorId.trim() && seniorName.trim()));

  const clearCart = () => {
    setCart([]);
    setSeniorPwd(false);
    setSeniorId("");
    setSeniorName("");
    setTendered("");
    setReference("");
    setMethod("cash");
    setTradeIn(false);
    setAcquisitionId("");
    setTradeInValue("");
    scanRef.current?.focus();
  };

  const charge = async () => {
    if (!canCharge) return;
    const { data: result, error } = await createSale.mutate({
      lines: cart.map((line) => ({
        kind: line.kind,
        itemId: line.itemId,
        unitId: line.unitId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
      })),
      seniorPwd: seniorPwd
        ? {
            idNumber: seniorId.trim(),
            type: "senior",
            name: seniorName.trim(),
            beneficiaries: 1,
          }
        : undefined,
      payments: [
        ...(tradeInAmount > 0
          ? [
              {
                method: "trade_in" as PaymentMethod,
                amount: tradeInAmount,
                acquisitionUlid: acquisitionId.trim(),
              },
            ]
          : []),
        ...(remainingDue > 0
          ? [
              {
                method,
                amount: remainingDue,
                reference:
                  method === "cash" ? undefined : reference.trim() || undefined,
                tendered: method === "cash" ? tenderedValue : undefined,
              },
            ]
          : []),
      ],
      cashierId: user.id,
    });

    if (result) {
      setCompleted(result);
      toast.success(`${result.saleNo} — ${peso(result.totalDue)} charged.`);
      clearCart();
      refetchShift();
    } else if (error) {
      const { message, description } = toastError(error, "Could not complete the sale.");
      toast.error(message, { description });

      /* The drawer can close under us — another device, or a shift that was
         never ours. Re-read it so the screen shows the open-shift prompt
         instead of a cart that cannot be charged. The cart is kept. */
      if ((error as { code?: string }).code === "SHIFT_NOT_OPEN") {
        refetchShift();
      }
    }
  };

  if (!openShift) {
    return (
      <div className="page space-y-4">
        <PageHeader eyebrow="Counter" title="Point of sale" />
        <Panel className="mx-auto max-w-md">
          <PanelBody className="space-y-4 text-center">
            <Lock className="mx-auto size-6 text-ink-faint" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">The drawer is closed.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Open a shift with a starting cash count before ringing up sales.
              </p>
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="starting-cash">Starting cash</Label>
              <InputMono
                id="starting-cash"
                inputMode="decimal"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>
            <Button
              className="w-full"
              disabled={openShiftMut.pending}
              onClick={async () => {
                const { data: result, error } = await openShiftMut.mutate(
                  Number(startingCash) || 0,
                );
                if (result) {
                  toast.success(`Shift ${result.shiftNo} open.`);
                  refetchShift();
                } else if (error) {
                  const { message, description } = toastError(
                    error,
                    "Could not open the shift.",
                  );
                  toast.error(message, { description });
                }
              }}
            >
              <Wallet aria-hidden /> Open drawer
            </Button>
          </PanelBody>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Counter"
        title="Point of sale"
        description="Scan or search, Enter adds to the cart. Handsets go by IMEI, everything else by quantity."
        actions={
          <span className="mono text-xs text-ink-faint">Shift {openShift.shiftNo}</span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] sm:gap-5">
        <div className="space-y-4 sm:space-y-5">
          <Panel>
            <PanelBody>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (matches.length > 0) addItem(matches[0]!, term);
                }}
              >
                <div className="relative">
                  <ScanBarcode
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                    aria-hidden
                  />
                  <InputMono
                    ref={scanRef}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Barcode, SKU, IMEI, or item name"
                    className="pl-9"
                    aria-label="Scan or search an item"
                  />
                </div>
              </form>

              {matches.length > 0 ? (
                <ul className="mt-2 divide-y divide-rule-soft rounded-lg border border-rule">
                  {matches.map((item) => {
                    const stock = itemStock(db, item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => addItem(item, term)}
                          disabled={stock <= 0}
                          className="tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">{item.name}</p>
                            <p className="mono text-xs text-ink-faint">{item.sku}</p>
                          </div>
                          <span className="mono text-xs text-ink-soft">{stock} left</span>
                          <span className="mono text-sm font-semibold text-ink">
                            {peso(item.sellingPrice)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Cart</PanelTitle>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="outline" size="xs" onClick={addService}>
                  <Plus aria-hidden /> Service
                </Button>
                {cart.length > 0 ? (
                  <Button variant="ghost" size="xs" onClick={clearCart}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </PanelHeader>

            {cart.length === 0 ? (
              <EmptyState
                icon={ScanBarcode}
                title="Nothing in the cart."
                body="Scan a barcode or search for an item to start a sale."
              />
            ) : (
              <ul className="divide-y divide-rule-soft">
                {cart.map((line) => (
                  <li key={line.key} className="flex items-center gap-3 px-3 py-2 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{line.name}</p>
                      <p className="mono text-xs text-ink-faint">
                        {line.sku} · {peso(line.unitPrice)}
                      </p>
                    </div>

                    {line.fixedQuantity ? (
                      <span className="mono text-xs text-ink-soft">×1</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={() => setQuantity(line.key, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus aria-hidden />
                        </Button>
                        <span className="mono w-6 text-center text-sm">{line.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          onClick={() => setQuantity(line.key, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus aria-hidden />
                        </Button>
                      </div>
                    )}

                    <span className="mono w-24 text-right text-sm font-semibold text-ink">
                      {peso(line.unitPrice * line.quantity)}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Panel className="xl:sticky xl:top-16">
            <PanelHeader>
              <PanelTitle>Charge</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <label className="flex items-start gap-2 text-sm text-ink">
                <Checkbox
                  checked={seniorPwd}
                  onCheckedChange={(checked) => setSeniorPwd(Boolean(checked))}
                  className="mt-0.5"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <BadgePercent className="size-3.5 text-ink-faint" aria-hidden />
                    Senior citizen / PWD
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    VAT-exempt, then 20% statutory discount.
                  </span>
                </span>
              </label>

              {seniorPwd ? (
                <div className="grid gap-2">
                  <Input
                    value={seniorName}
                    onChange={(e) => setSeniorName(e.target.value)}
                    placeholder="Name on the ID"
                  />
                  <InputMono
                    value={seniorId}
                    onChange={(e) => setSeniorId(e.target.value)}
                    placeholder="ID number"
                  />
                </div>
              ) : null}

              <div className="space-y-1 border-t border-rule-soft pt-3 text-sm">
                <Row label="Subtotal" value={peso(subtotal)} />
                {tax.seniorPwdDiscount > 0 ? (
                  <Row
                    label="Senior / PWD discount"
                    value={`− ${peso(tax.seniorPwdDiscount)}`}
                    tone="bench"
                  />
                ) : null}
                {db.shop.vatRegistered && tax.vatAmount > 0 ? (
                  <Row label={`VAT (${Math.round(db.shop.vatRate * 100)}%)`} value={peso(tax.vatAmount)} muted />
                ) : null}
                {tax.vatExemptSales > 0 ? (
                  <Row label="VAT-exempt sales" value={peso(tax.vatExemptSales)} muted />
                ) : null}
                <div className="flex items-baseline justify-between border-t border-rule-soft pt-2 text-base font-semibold">
                  <span className="text-ink">Total due</span>
                  <span className="mono text-ink">{peso(tax.totalDue)}</span>
                </div>
                {tradeInAmount > 0 ? (
                  <>
                    <Row
                      label="Trade-in"
                      value={`− ${peso(tradeInAmount)}`}
                      tone="bench"
                    />
                    <div className="flex items-baseline justify-between pt-1 text-sm font-semibold">
                      <span className="text-ink">Remaining to pay</span>
                      <span className="mono text-ink">{peso(remainingDue)}</span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-sm text-ink">
                  <Checkbox
                    checked={tradeIn}
                    onCheckedChange={(checked) => setTradeIn(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Repeat className="size-3.5 text-ink-faint" aria-hidden />
                      Apply a trade-in
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      Spend a completed buy-back acquisition as tender.
                    </span>
                  </span>
                </label>

                {tradeIn ? (
                  <div className="grid gap-2 pt-1">
                    <InputMono
                      value={acquisitionId}
                      onChange={(e) => setAcquisitionId(e.target.value.trim())}
                      placeholder="Acquisition ID"
                      aria-label="Acquisition ID"
                    />
                    <InputMono
                      inputMode="decimal"
                      value={tradeInValue}
                      onChange={(e) =>
                        setTradeInValue(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      placeholder="Trade-in value"
                      aria-label="Trade-in value"
                    />
                    {(Number(tradeInValue) || 0) > tax.totalDue ? (
                      <p className="text-xs text-ink-soft">
                        Capped at the {peso(tax.totalDue)} total — the rest stays
                        on the acquisition.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {remainingDue === 0 && tradeInAmount > 0 ? (
                <div className="rounded-md bg-bench-fill px-2.5 py-2 text-sm font-medium text-bench-ink">
                  Trade-in covers the full amount.
                </div>
              ) : (
              <>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      aria-pressed={method === m.value}
                      className={cn(
                        "tap rounded-md border px-2 text-xs font-medium transition-colors",
                        method === m.value
                          ? "border-bench bg-bench-fill text-bench-ink"
                          : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {method === "cash" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tendered">Cash tendered</Label>
                  <InputMono
                    id="tendered"
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[100, 200, 500, 1000].map((note) => (
                      <Button
                        key={note}
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setTendered(String((Number(tendered) || 0) + note))
                        }
                      >
                        +{note}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setTendered(String(remainingDue))}
                    >
                      Exact
                    </Button>
                  </div>
                  {tenderedValue > 0 ? (
                    <div
                      className={cn(
                        "mt-2 flex items-baseline justify-between rounded-md px-2.5 py-2 text-sm font-semibold",
                        shortBy > 0
                          ? "bg-stamp-fill text-stamp-ink"
                          : "bg-bench-fill text-bench-ink",
                      )}
                    >
                      <span>{shortBy > 0 ? "Short by" : "Change"}</span>
                      <span className="mono">{peso(shortBy > 0 ? shortBy : change)}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="reference">Reference number</Label>
                  <InputMono
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Confirmation or auth code"
                  />
                </div>
              )}
              </>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={charge}
                disabled={!canCharge}
              >
                <Banknote aria-hidden />
                {createSale.pending
                  ? "Charging…"
                  : `Charge ${peso(tradeInAmount > 0 ? remainingDue : tax.totalDue)}`}
              </Button>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Dialog open={Boolean(completed)} onOpenChange={(open) => !open && setCompleted(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-bench" aria-hidden />
              Sale complete
            </DialogTitle>
          </DialogHeader>

          {completed ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-rule bg-copy p-3">
                <div className="flex items-baseline justify-between">
                  <span className="mono text-sm font-semibold text-ink">
                    {completed.saleNo}
                  </span>
                  <span className="mono text-lg font-semibold text-ink">
                    {peso(completed.totalDue)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {completed.lines.length} line{completed.lines.length === 1 ? "" : "s"} ·{" "}
                  {completed.payments.map((p) => p.method).join(", ")}
                </p>
                {completed.payments[0]?.change ? (
                  <p className="mono mt-2 text-sm text-bench-ink">
                    Change: {peso(completed.payments[0].change)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="label-pad">Roll</span>
                  {([58, 80] as const).map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setRollWidth(width)}
                      aria-pressed={rollWidth === width}
                      className={cn(
                        "mono rounded-md border px-2 py-1 text-xs transition-colors",
                        rollWidth === width
                          ? "border-bench bg-bench-fill font-semibold text-bench-ink"
                          : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                      )}
                    >
                      {width}mm
                    </button>
                  ))}
                </div>

                <Button variant="outline" onClick={() => window.print()}>
                  <Printer aria-hidden /> Print receipt
                </Button>
                <Button className="ml-auto" onClick={() => setCompleted(null)}>
                  Next sale
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mounted only while the dialog is up. `window.print()` prints the whole
          document, so the receipt has to exist as a document of its own —
          without this the printer spooled the dimmed screen and the dialog. */}
      {completed ? (
        <PrintDocument>
          <SaleReceipt
            sale={completed}
            shop={db.shop}
            cashier={user}
            customer={db.customers.find((c) => c.id === completed.customerId)}
            width={rollWidth}
          />
        </PrintDocument>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "bench";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn(muted ? "text-ink-faint" : "text-ink-soft")}>{label}</span>
      <span
        className={cn(
          "mono",
          tone === "bench" ? "text-bench-ink" : muted ? "text-ink-faint" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
