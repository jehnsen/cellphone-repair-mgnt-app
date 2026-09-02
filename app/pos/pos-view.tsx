"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  BadgePercent,
  Banknote,
  CheckCircle2,
  Lock,
  LogOut,
  Minus,
  Plus,
  Printer,
  Repeat,
  ScanBarcode,
  Search,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, InputMono } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import { PrintDocument } from "@/components/print/print-document";
import { SaleReceipt } from "@/components/print/sale-receipt";
import { itemStock } from "@/lib/shop/queries";
import { computeTax } from "@/lib/vat";
import { formatDateTime, money, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NewSaleInput } from "@/lib/shop/contract";
import type {
  InventoryItem,
  PaymentMethod,
  Sale,
  SaleLineKind,
  ServiceItem,
  Shift,
} from "@/lib/types";

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
  const [servicePicker, setServicePicker] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const [cashMoving, setCashMoving] = useState(false);

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

  const addService = (service: ServiceItem) => {
    setCart((prev) => [
      ...prev,
      {
        /* Unique per add, so the same service can be rung twice. */
        key: `svc-${service.id}-${Date.now()}`,
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

  const activeServices = useMemo(
    () => db.services.filter((service) => service.active),
    [db.services],
  );

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mono text-xs text-ink-faint">
              {openShift.shiftNo} · {peso(openShift.expectedCash ?? openShift.startingCash)} drawer
            </span>
            <Button variant="outline" size="xs" onClick={() => setCashMoving(true)}>
              <ArrowDownUp aria-hidden /> Cash in / out
            </Button>
            <Button variant="outline" size="xs" onClick={() => setClosingShift(true)}>
              <LogOut aria-hidden /> Close shift
            </Button>
          </div>
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
                <ul className="mt-2 divide-y divide-rule-soft rounded-sm border border-rule">
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
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setServicePicker(true)}
                >
                  <Wrench aria-hidden /> Service
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
              <div className="rounded-sm border border-rule bg-copy p-3">
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

      {servicePicker ? (
        <ServicePickerDialog
          services={activeServices}
          onPick={addService}
          onClose={() => setServicePicker(false)}
        />
      ) : null}

      {closingShift ? (
        <CloseShiftDialog
          shift={openShift}
          cashierId={user.id}
          onClose={() => setClosingShift(false)}
          onClosed={refetchShift}
        />
      ) : null}

      {cashMoving ? (
        <CashMovementDialog
          shift={openShift}
          cashierId={user.id}
          onClose={() => setCashMoving(false)}
          onDone={refetchShift}
        />
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: "bench";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span
        className={cn(
          muted ? "text-ink-faint" : "text-ink-soft",
          strong && "font-medium text-ink",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "mono",
          strong && "font-semibold",
          tone === "bench" ? "text-bench-ink" : muted ? "text-ink-faint" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Service picker ──────────────────────────────────────────────────────
   The catalog's services, searchable — plus a custom one-off. Replaces the
   old "grab the first active service" shortcut, which quietly rang up the
   wrong labour. A custom line is created as a real service because the
   server prices a service line from the record, never a per-line override. */
function ServicePickerDialog({
  services,
  onPick,
  onClose,
}: {
  services: ServiceItem[];
  onPick: (service: ServiceItem) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pick" | "custom">("pick");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  const createCustom = useMutation(
    (api, input: { name: string; price: number; category?: string }) =>
      api.createService(input),
  );

  const rows = useMemo(() => {
    const sorted = [...services].sort((a, b) => a.name.localeCompare(b.name));
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((service) =>
      `${service.name} ${service.code} ${service.category}`.toLowerCase().includes(needle),
    );
  }, [services, q]);

  const priceNum = Number.parseFloat(price || "0");
  const canCreate =
    name.trim().length > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    !createCustom.pending;

  const submitCustom = async () => {
    if (!canCreate) return;
    const { data, error } = await createCustom.mutate({
      name: name.trim(),
      price: money(priceNum),
      category: category.trim() || undefined,
    });
    if (data) {
      onPick(data);
      toast.success(`${data.name} added.`);
      onClose();
    } else if (error) {
      const { message, description } = toastError(
        error,
        "Could not add the custom service.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4 text-ink-faint" aria-hidden />
            {mode === "custom" ? "Custom service" : "Add a service"}
          </DialogTitle>
        </DialogHeader>

        {mode === "custom" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-name" className="label-pad">
                Name
              </Label>
              <Input
                id="cs-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Back camera lens swap"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
              <div className="space-y-1.5">
                <Label htmlFor="cs-category" className="label-pad">
                  Category (optional)
                </Label>
                <Input
                  id="cs-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="custom"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-price" className="label-pad">
                  Price
                </Label>
                <InputMono
                  id="cs-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <p className="text-xs text-ink-faint">
              Added to the service catalog so the sale and the reports have a
              real line to point at. It stays available in this list afterwards.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setMode("pick")}
                disabled={createCustom.pending}
              >
                Back
              </Button>
              <Button onClick={submitCustom} disabled={!canCreate}>
                {createCustom.pending
                  ? "Adding…"
                  : `Add ${priceNum > 0 ? peso(money(priceNum)) : "service"}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, code, or category"
                className="pl-8"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => setMode("custom")}
              className="tap flex w-full items-center gap-2 rounded-sm border border-dashed border-rule px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-secondary"
            >
              <Plus className="size-3.5 shrink-0" aria-hidden />
              Custom service — name it and set the price
            </button>

            {rows.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No service matches."
                body="Try the service code, a different word, or add a custom one above."
              />
            ) : (
              <ul className="max-h-[45vh] divide-y divide-rule-soft overflow-y-auto rounded-sm border border-rule">
                {rows.map((service) => (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(service);
                        onClose();
                      }}
                      className="tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{service.name}</p>
                        <p className="mono text-xs text-ink-faint">
                          {service.code} · {service.category}
                        </p>
                      </div>
                      <span className="mono text-sm font-semibold text-ink">
                        {peso(service.standardPrice)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Drawer: close and cash in/out ──────────────────────────────────────
   `closeShift` and `addCashMovement` existed on the contract but had no UI,
   so a shift opened at the counter could never be reconciled from here. */
function CloseShiftDialog({
  shift,
  cashierId,
  onClose,
  onClosed,
}: {
  shift: Shift;
  cashierId: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const close = useMutation((api, input: { countedCash: number; note?: string }) =>
    api.closeShift({
      shiftId: shift.id,
      countedCash: input.countedCash,
      userId: cashierId,
      note: input.note,
    }),
  );

  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");

  const cashIn = shift.movements
    .filter((m) => m.kind === "cash_in")
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = shift.movements
    .filter((m) => m.kind === "cash_out")
    .reduce((sum, m) => sum + m.amount, 0);
  /* The server's own figure when it gives one; otherwise reconstruct it. */
  const expected =
    shift.expectedCash ?? money(shift.startingCash + cashIn - cashOut);

  const countedNum = Number.parseFloat(counted || "0");
  const hasCount = counted.trim() !== "" && Number.isFinite(countedNum);
  const variance = hasCount ? money(countedNum - expected) : 0;

  const submit = async () => {
    if (!hasCount) return;
    const { data, error } = await close.mutate({
      countedCash: money(countedNum),
      note: note.trim() || undefined,
    });
    if (data) {
      toast.success(`Shift ${data.shiftNo} closed.`, {
        description:
          variance === 0
            ? "Drawer balanced."
            : variance > 0
              ? `Over by ${peso(variance)}.`
              : `Short by ${peso(Math.abs(variance))}.`,
      });
      onClosed();
      onClose();
    } else if (error) {
      const { message, description } = toastError(error, "Could not close the shift.");
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="size-4 text-ink-faint" aria-hidden />
            Close shift {shift.shiftNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="rounded-sm border border-rule bg-paper px-3 py-2 text-sm">
            <Row label="Opened" value={formatDateTime(shift.openedAt)} />
            <Row label="Starting cash" value={peso(shift.startingCash)} />
            {cashIn > 0 ? (
              <Row label="Paid in" value={`+ ${peso(cashIn)}`} tone="bench" />
            ) : null}
            {cashOut > 0 ? <Row label="Paid out" value={`− ${peso(cashOut)}`} /> : null}
            <Row label="Expected in drawer" value={peso(expected)} strong />
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="close-counted" className="label-pad">
              Counted cash
            </Label>
            <InputMono
              id="close-counted"
              inputMode="decimal"
              autoFocus
              value={counted}
              onChange={(e) => setCounted(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
            />
          </div>

          {hasCount ? (
            <div
              className={cn(
                "flex items-baseline justify-between rounded-md px-2.5 py-2 text-sm font-semibold",
                variance === 0
                  ? "bg-bench-fill text-bench-ink"
                  : variance > 0
                    ? "bg-flag-fill text-flag-ink"
                    : "bg-stamp-fill text-stamp-ink",
              )}
            >
              <span>{variance === 0 ? "Balances" : variance > 0 ? "Over" : "Short"}</span>
              <span className="mono">{peso(Math.abs(variance))}</span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="close-note" className="label-pad">
              Note (optional)
            </Label>
            <Textarea
              id="close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything that explains a variance."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={close.pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={!hasCount || close.pending}
            >
              {close.pending ? "Closing…" : "Close shift"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CashMovementDialog({
  shift,
  cashierId,
  onClose,
  onDone,
}: {
  shift: Shift;
  cashierId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const move = useMutation(
    (api, input: { kind: "cash_in" | "cash_out"; amount: number; reason: string }) =>
      api.addCashMovement({
        shiftId: shift.id,
        kind: input.kind,
        amount: input.amount,
        reason: input.reason,
        userId: cashierId,
      }),
  );

  const [kind, setKind] = useState<"cash_in" | "cash_out">("cash_out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const value = Number.parseFloat(amount || "0");
  const valid =
    Number.isFinite(value) && value > 0 && reason.trim().length > 0 && !move.pending;

  const submit = async () => {
    if (!valid) return;
    const { data, error } = await move.mutate({
      kind,
      amount: money(value),
      reason: reason.trim(),
    });
    if (data) {
      toast.success(
        kind === "cash_in"
          ? `Paid in ${peso(money(value))}.`
          : `Paid out ${peso(money(value))}.`,
      );
      onDone();
      onClose();
    } else if (error) {
      const { message, description } = toastError(
        error,
        "Could not record the cash movement.",
      );
      toast.error(message, { description });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownUp className="size-4 text-ink-faint" aria-hidden />
            Cash in / out — {shift.shiftNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "cash_in", label: "Paid in" },
                { value: "cash_out", label: "Paid out" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                aria-pressed={kind === option.value}
                className={cn(
                  "tap rounded-md border px-2.5 py-2 text-sm font-medium transition-colors",
                  kind === option.value
                    ? "border-bench bg-bench-fill text-bench-ink"
                    : "border-rule bg-paper text-ink-soft hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cash-amount" className="label-pad">
              Amount
            </Label>
            <InputMono
              id="cash-amount"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cash-reason" className="label-pad">
              Reason
            </Label>
            <Input
              id="cash-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                kind === "cash_in" ? "Float top-up, owner deposit…" : "Supplier COD, petty cash…"
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={move.pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!valid}>
              {move.pending
                ? "Recording…"
                : `Record ${value > 0 ? peso(money(value)) : ""}`.trim()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
