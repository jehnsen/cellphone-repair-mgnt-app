import { money } from "@/lib/format";
import type {
  CashMovementDto,
  PaymentDto,
  ProductDto,
  SaleDto,
  SerializedUnitDto,
  ServiceDto,
  ShiftDto,
  StockMovementDto,
  SupplierDto,
} from "@/lib/api/dto";
import type {
  HandsetUnit,
  HandsetUnitStatus,
  MovementReason,
  Payment,
  PaymentMethod,
  Sale,
  SaleLine,
  SaleLineKind,
  SalePayment,
  Shift,
  StockMovement,
  Supplier,
} from "@/lib/types";

/**
 * Wire → domain for the commerce half: the stock ledger, point of sale, the
 * cash drawer, and money on a ticket.
 *
 * Split from `mappers.ts` only for size — the same rule applies: this is the
 * one place the server's vocabulary becomes the domain's.
 */

const num = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? money(parsed) : fallback;
};

const optional = (value: number | string | null | undefined): number | undefined =>
  value === null || value === undefined ? undefined : num(value);

/* ── Suppliers and serialized units ──────────────────────────────────── */

export function toSupplier(dto: SupplierDto): Supplier {
  return {
    id: dto.ulid,
    name: dto.name,
    contactPerson: dto.contact_name ?? undefined,
    mobile: dto.contact_phone ?? undefined,
    email: dto.contact_email ?? undefined,
    address: undefined,
    terms: dto.terms ?? undefined,
    note: dto.notes ?? undefined,
    active: dto.is_active ?? true,
  };
}

const UNIT_STATUS: Record<string, HandsetUnitStatus> = {
  in_stock: "in_stock",
  reserved: "reserved",
  sold: "sold",
  for_repair: "for_repair",
  /* The domain has no "written off". A retired unit is out of stock either
     way, and `returned` is the closest non-sellable state the UI draws. */
  written_off: "returned",
};

export function toHandsetUnit(dto: SerializedUnitDto, itemId: string): HandsetUnit {
  return {
    id: dto.ulid,
    itemId,
    imei: dto.imei ?? dto.serial_number ?? "",
    condition: dto.condition,
    status: UNIT_STATUS[dto.status] ?? "in_stock",
    /* `acquisition_cost` is permission-gated: absent entirely for a cashier. */
    cost: num(dto.acquisition_cost),
    price: num(dto.product?.selling_price),
    warrantyDays: 0,
    receivedAt: dto.created_at ?? new Date().toISOString(),
    notes: dto.warranty_terms ?? undefined,
  };
}

/* ── Stock ledger ────────────────────────────────────────────────────── */

const MOVEMENT_REASON: Record<string, MovementReason> = {
  receipt: "receiving",
  goods_receipt: "receiving",
  purchase: "receiving",
  sale: "sale",
  refund: "return_customer",
  adjustment: "count_correction",
  count_variance: "count_correction",
  damage: "damaged",
  loss: "lost",
  write_off: "damaged",
  return_to_supplier: "return_supplier",
  repair_consumption: "repair_consumption",
  refurb_consumption: "repair_consumption",
};

export function toStockMovement(dto: StockMovementDto): StockMovement {
  /* `reason_code` is finer-grained than the domain's fixed set, so prefer it
     when it maps and fall back to the movement type. */
  const reason =
    (dto.reason_code ? MOVEMENT_REASON[dto.reason_code] : undefined) ??
    MOVEMENT_REASON[dto.movement_type] ??
    "count_correction";

  return {
    id: dto.ulid,
    itemId: dto.product?.ulid ?? "",
    unitId: dto.serialized_unit?.ulid,
    quantity: num(dto.quantity),
    reason,
    reference: dto.reference_type ?? undefined,
    unitCost: optional(dto.unit_cost),
    note: dto.reason_code ?? undefined,
    at: dto.occurred_at ?? new Date().toISOString(),
    by: dto.actor?.ulid ?? "",
  };
}

/* ── Money ───────────────────────────────────────────────────────────── */

const PAYMENT_METHOD: Record<string, PaymentMethod> = {
  cash: "cash",
  gcash: "gcash",
  maya: "maya",
  card: "card",
  bank_transfer: "bank_transfer",
  trade_in: "trade_in",
  /* Store credit has no domain equivalent. It reconciles like a transfer and,
     importantly, never touches the drawer. */
  store_credit: "bank_transfer",
};

export function toPaymentMethod(method: string): PaymentMethod {
  return PAYMENT_METHOD[method] ?? "cash";
}

export function toSalePayment(dto: PaymentDto): SalePayment {
  return {
    id: dto.ulid,
    method: toPaymentMethod(dto.method),
    amount: num(dto.amount),
    reference: dto.reference_number ?? undefined,
    tendered: optional(dto.tendered),
    change: optional(dto.change_given),
  };
}

export function toTicketPayment(dto: PaymentDto, kind: Payment["kind"]): Payment {
  return {
    id: dto.ulid,
    amount: num(dto.amount),
    method: toPaymentMethod(dto.method),
    reference: dto.reference_number ?? undefined,
    kind,
    receivedAt: dto.created_at ?? new Date().toISOString(),
    receivedBy: dto.actor?.ulid ?? "",
  };
}

/* ── Sales ───────────────────────────────────────────────────────────── */

type Sellable = Partial<ProductDto> & Partial<SerializedUnitDto> & Partial<ServiceDto>;

export function toSale(dto: SaleDto): Sale {
  const lines: SaleLine[] = (dto.lines ?? []).map((line, index) => {
    const sellable = (line.sellable ?? null) as Sellable | null;

    const kind: SaleLineKind =
      line.sellable_type === "serialized_unit"
        ? "handset"
        : line.sellable_type === "service"
          ? "service"
          : sellable?.type === "handset"
            ? "handset"
            : "accessory";

    return {
      id: `${dto.ulid}-line-${index}`,
      kind,
      itemId:
        line.sellable_type === "serialized_unit"
          ? sellable?.product?.ulid
          : sellable?.ulid,
      unitId: line.sellable_type === "serialized_unit" ? sellable?.ulid : undefined,
      sku: sellable?.sku ?? "",
      name:
        sellable?.name ??
        (line.sellable_type === "serialized_unit"
          ? (sellable?.product?.name ?? "Handset")
          : "Item"),
      quantity: num(line.quantity, 1),
      unitPrice: num(line.unit_price),
      unitCost: num(line.unit_cost),
      discount: line.line_discount
        ? { kind: "amount" as const, value: num(line.line_discount) }
        : undefined,
      lineTotal: num(line.amount),
    };
  });

  const statutory = (dto.discounts ?? []).find(
    (discount) => discount.type === "senior_citizen" || discount.type === "pwd",
  );
  const ordinary = (dto.discounts ?? []).find(
    (discount) => discount.type === "percent" || discount.type === "amount",
  );

  return {
    id: dto.ulid,
    saleNo: dto.sale_number,
    customerId: dto.customer?.ulid,
    lines,
    subtotal: num(dto.subtotal),
    orderDiscount: ordinary
      ? {
          kind: ordinary.type === "percent" ? "percent" : "amount",
          value: num(ordinary.value),
        }
      : undefined,
    seniorPwdDiscount: statutory
      ? {
          idNumber: statutory.id_number ?? "",
          type: statutory.type === "pwd" ? "pwd" : "senior",
          name: statutory.cardholder_name ?? "",
          beneficiaries: 1,
          vatExemptSales: num(dto.vat_exempt_sales),
          discountAmount: num(dto.discount_total),
        }
      : undefined,
    vatableSales: num(dto.vatable_sales),
    vatExemptSales: num(dto.vat_exempt_sales),
    vatAmount: num(dto.vat_amount),
    zeroRatedSales: num(dto.zero_rated_sales),
    totalDue: num(dto.total),
    payments: (dto.payments ?? []).map(toSalePayment),
    status:
      dto.status === "void"
        ? "void"
        : dto.status === "refunded"
          ? "returned"
          : dto.status === "partially_refunded"
            ? "partially_returned"
            : "completed",
    cashierId: dto.cashier?.ulid ?? "",
    /* The sale resource does not name its shift; the drawer screen reconciles
       from the shift's own expected_cash instead. */
    shiftId: "",
    soldAt: dto.created_at ?? new Date().toISOString(),
    note: dto.void_reason ?? undefined,
  };
}

/* ── The drawer ──────────────────────────────────────────────────────── */

export function toShift(dto: ShiftDto): Shift {
  const openedAt = dto.opened_at ?? new Date().toISOString();

  return {
    id: dto.ulid,
    shiftNo: `SH-${dto.ulid.slice(-6).toUpperCase()}`,
    openedBy: dto.cashier?.ulid ?? "",
    openedAt,
    startingCash: num(dto.opening_float),
    closedBy: dto.closed_at ? (dto.cashier?.ulid ?? "") : undefined,
    closedAt: dto.closed_at ?? undefined,
    countedCash: optional(dto.counted_cash),
    expectedCash: optional(dto.expected_cash),
    variance: optional(dto.variance),
    movements: (dto.cash_movements ?? []).map((movement: CashMovementDto, index) => ({
      id: `${dto.ulid}-cash-${index}`,
      shiftId: dto.ulid,
      kind: movement.direction === "in" ? ("cash_in" as const) : ("cash_out" as const),
      amount: num(movement.amount),
      reason: movement.reason,
      at: movement.created_at ?? openedAt,
      by: movement.actor?.ulid ?? "",
    })),
    note: dto.notes ?? undefined,
    status: dto.is_open ? "open" : "closed",
  };
}
