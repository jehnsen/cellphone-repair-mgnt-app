import { money, initialsOf } from "@/lib/format";
import type { DashboardSummary } from "@/lib/shop/contract";
import { toTicketPayment } from "@/lib/api/mappers-commerce";
import type {
  BranchDto,
  BoardDto,
  DashboardDto,
  DashboardMetricsDto,
  CustomerDeviceDto,
  CustomerDto,
  StoreCreditDto,
  StoreCreditEntryDto,
  DeviceBrandDto,
  DeviceModelDto,
  MessageTemplateDto,
  ProductDto,
  RepairTicketDto,
  ServiceDto,
  SettingDto,
  TicketEventDto,
  TicketLineDto,
  TicketPhotoDto,
  TicketQuoteDto,
  PaymentDto,
  UserDto,
  RepairFindingDto,
} from "@/lib/api/dto";
import type {
  BranchProfile,
  BranchSummary,
  ConditionCheck,
  Customer,
  DeviceBrand,
  DeviceModel,
  DeviceType,
  InventoryItem,
  MessageEventKey,
  MessageTemplate,
  PartConsumption,
  Payment,
  ProblemTag,
  QuoteState,
  Role,
  ServiceItem,
  ShopProfile,
  ShopSetting,
  StoreCredit,
  StoreCreditEntry,
  StoreCreditSource,
  Ticket,
  TicketPhoto,
  TicketStatus,
  TimelineEvent,
  TimelineEventType,
  TurnedOverAccessory,
  UnlockMethod,
  User,
  RepairFinding,
} from "@/lib/types";

/**
 * Wire → domain. The only place the two vocabularies meet.
 *
 * Three gaps are bridged here rather than in the screens, and each is marked
 * where it happens:
 *   1. `promised_date` is a calendar day; the board reasons in instants, so a
 *      date becomes 5pm Manila — close of business, which is what the shop
 *      means by "promised Thursday".
 *   2. The API has no `status_changed_at`; a status change is the only thing
 *      that touches the row on transition, so `updated_at` stands in for it.
 *   3. Money arrives as a decimal string from MySQL. Everything is coerced
 *      through `num()` so no screen ever does arithmetic on "1800.00".
 */

const num = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? money(parsed) : fallback;
};

/** A promised calendar day means "by close of business", i.e. 5pm Manila. */
export function promisedAtFrom(date: string | null | undefined): string {
  if (!date) {
    const fallback = new Date();
    fallback.setHours(17, 0, 0, 0);
    return fallback.toISOString();
  }
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return dayOnly ? new Date(`${date}T17:00:00+08:00`).toISOString() : date;
}

/** The reverse: the API wants a bare calendar day. */
export function promisedDateFor(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/* ── People ──────────────────────────────────────────────────────────── */

const ROLE_ORDER: Role[] = ["owner", "manager", "cashier", "technician"];

export function toUser(dto: UserDto): User {
  const roles = (dto.roles ?? []).map((role) => role.toLowerCase());
  const role = ROLE_ORDER.find((known) => roles.includes(known)) ?? "cashier";

  return {
    id: dto.ulid,
    name: dto.name,
    initials: initialsOf(dto.name),
    role,
    email: dto.email || undefined,
    mobile: undefined,
    active: dto.is_active ?? true,
    isTechnician: roles.includes("technician"),
    employeeCode: dto.employee_code || undefined,
    branchId: dto.branch?.ulid,
    branchName: dto.branch?.name,
    branchCode: dto.branch?.code,
  };
}

export function toCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.ulid,
    name: dto.name,
    mobile: dto.mobile,
    email: dto.email ?? undefined,
    address: dto.address ?? undefined,
    notes: dto.notes ?? undefined,
    createdAt: dto.created_at ?? new Date().toISOString(),
  };
}

const STORE_CREDIT_SOURCE: Record<string, StoreCreditSource> = {
  refund: "refund",
  store_credit_refund: "refund",
  payment: "payment",
  store_credit_payment: "payment",
  adjustment: "adjustment",
  manual_adjustment: "adjustment",
};

function toStoreCreditEntry(dto: StoreCreditEntryDto): StoreCreditEntry {
  const amount = num(dto.amount);
  return {
    id: dto.ulid,
    /* Fall back to the sign of the amount when the server omits a direction. */
    direction: dto.direction ?? (amount < 0 ? "debit" : "credit"),
    amount: Math.abs(amount),
    balanceAfter:
      dto.balance_after === null || dto.balance_after === undefined
        ? undefined
        : num(dto.balance_after),
    reason: dto.reason?.trim() || "—",
    source: STORE_CREDIT_SOURCE[dto.source ?? ""] ?? "other",
    reference: dto.reference ?? undefined,
    at: dto.created_at ?? new Date().toISOString(),
    by: dto.actor?.name ?? undefined,
  };
}

export function toStoreCredit(customerId: string, dto: StoreCreditDto): StoreCredit {
  const rows = dto.entries ?? dto.ledger ?? [];
  return {
    customerId,
    balance: num(dto.balance),
    ledger: rows
      .map(toStoreCreditEntry)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  };
}

/* ── Devices ─────────────────────────────────────────────────────────── */

export function toDeviceBrand(dto: DeviceBrandDto): DeviceBrand {
  return { id: dto.ulid, name: dto.name, active: dto.is_active ?? true };
}

export function toDeviceModel(dto: DeviceModelDto): DeviceModel {
  return {
    id: dto.ulid,
    name: dto.name,
    brandId: dto.brand?.ulid ?? "",
    brandName: dto.brand?.name ?? "",
    releaseYear: dto.release_year ?? undefined,
    active: dto.is_active ?? true,
  };
}

/** The API has no device type; the model name is the only signal there is. */
export function deviceTypeFor(model: string | null | undefined): DeviceType {
  const name = (model ?? "").toLowerCase();
  if (/\b(ipad|tab|tablet)\b/.test(name)) return "tablet";
  if (/\b(watch)\b/.test(name)) return "smartwatch";
  if (/\b(book|ideapad|aspire|laptop|vivobook|inspiron)\b/.test(name)) {
    return "laptop";
  }
  return "phone";
}

const UNLOCK_METHODS: UnlockMethod[] = ["pin", "pattern", "password", "none"];
const PROBLEM_TAGS: ProblemTag[] = [
  "screen",
  "battery",
  "charging_port",
  "water_damage",
  "no_power",
  "software",
  "camera",
  "speaker",
  "board_level",
];
const TURNED_OVER: TurnedOverAccessory[] = [
  "sim",
  "sd_card",
  "case",
  "charger",
  "box",
];
const CONDITION_CHECKS: ConditionCheck[] = [
  "screen_cracked",
  "back_cracked",
  "dents",
  "scratches",
  "water_indicator",
  "missing_screws",
  "prior_repair",
  "powers_on",
  "buttons_ok",
  "camera_ok",
];

const keepKnown = <T extends string>(values: unknown, allowed: T[]): T[] =>
  Array.isArray(values) ? (values.filter((v) => allowed.includes(v as T)) as T[]) : [];

/* ── Tickets ─────────────────────────────────────────────────────────── */

const TICKET_STATUSES: TicketStatus[] = [
  "received",
  "diagnosed",
  "awaiting_approval",
  "awaiting_parts",
  "in_repair",
  "qc",
  "ready_for_pickup",
  "released",
  "unrepairable",
  "returned_as_is",
  "unclaimed",
];

export function toTicketStatus(value: string): TicketStatus {
  return (TICKET_STATUSES as string[]).includes(value)
    ? (value as TicketStatus)
    : "received";
}

export interface TicketExtras {
  lines?: TicketLineDto[];
  photos?: TicketPhotoDto[];
  quotes?: TicketQuoteDto[];
  /** The ticket own payment ledger, from /tickets/{id}/payments. */
  payments?: PaymentDto[];
}

export function toTicket(dto: RepairTicketDto, extras: TicketExtras = {}): Ticket {
  const status = toTicketStatus(dto.status);
  const device = dto.customer_device;
  const model = dto.device?.model ?? device?.device_model?.name ?? "";

  const partsUsed = (extras.lines ?? [])
    .filter((line) => line.line_type === "part")
    .map<PartConsumption>((line, index) => ({
      id: `${dto.ulid}-part-${index}`,
      itemId: line.product?.ulid ?? "",
      sku: line.product?.sku ?? "",
      name: line.description ?? line.product?.name ?? "Part",
      quantity: num(line.quantity, 1),
      unitCost: num(line.unit_cost),
      unitPrice: num(line.unit_price),
      consumedAt: line.created_at ?? dto.updated_at ?? new Date().toISOString(),
      consumedBy: "",
    }));

  const partsTotal = money(
    partsUsed.reduce((sum, part) => sum + part.quantity * part.unitPrice, 0),
  );
  const laborCharge = money(
    (extras.lines ?? [])
      .filter((line) => line.line_type === "labor")
      .reduce((sum, line) => sum + num(line.amount), 0),
  );

  const estimatedCost = num(dto.estimated_cost);
  const approvedAmount =
    dto.approved_amount === null || dto.approved_amount === undefined
      ? undefined
      : num(dto.approved_amount);
  const totalDue = approvedAmount ?? estimatedCost;

  /**
   * What has actually been paid.
   *
   * `downpayment` is only the money taken at intake — everything after that
   * lives in the ticket's payment ledger, which the list endpoint does not
   * carry. Reading `downpayment` alone reported a fully paid job as unpaid.
   *
   * So: sum the ledger when it is loaded (detail), and otherwise derive it
   * from the server's own `balance`, which is `total − downpayment − paid`.
   */
  const serverBalance =
    dto.balance === null || dto.balance === undefined ? undefined : num(dto.balance);
  const ledgerPaid = extras.payments?.length
    ? money(extras.payments.reduce((sum, payment) => sum + num(payment.amount), 0))
    : 0;

  const amountPaid = extras.payments
    ? money(num(dto.downpayment) + ledgerPaid)
    : serverBalance !== undefined
      ? money(Math.max(0, totalDue - serverBalance))
      : num(dto.downpayment);

  /* Detail carries the real ledger from /tickets/{id}/payments. The list does
     not, so there `downpayment` stands in as a single opening payment — the
     balance is the server's either way. */
  const payments: Payment[] = extras.payments?.length
    ? extras.payments.map((payment, index) =>
        toTicketPayment(payment, index === 0 ? "downpayment" : "balance"),
      )
    : amountPaid
      ? [
          {
            id: `${dto.ulid}-downpayment`,
            amount: amountPaid,
            method: "cash",
            kind: "downpayment",
            receivedAt: dto.created_at ?? new Date().toISOString(),
            receivedBy: "",
          },
        ]
      : [];

  return {
    id: dto.ulid,
    ticketNo: dto.ticket_number,
    claimCode: dto.claim_code,
    status,
    customerId: dto.customer?.ulid ?? "",
    device: {
      type: deviceTypeFor(model),
      brand: dto.device?.brand ?? device?.device_model?.brand?.name ?? "",
      model,
      color: dto.device?.color ?? device?.color ?? "",
      imei: device?.imei ?? device?.serial_number ?? "",
      unlockMethod: UNLOCK_METHODS.includes(dto.unlock_method as UnlockMethod)
        ? (dto.unlock_method as UnlockMethod)
        : "none",
      unlockValue: dto.unlock_value ?? undefined,
    },
    reportedProblem: dto.reported_problem ?? "",
    problemTags: keepKnown(dto.problem_tags, PROBLEM_TAGS),
    turnedOver: keepKnown(dto.accessories_turned_over, TURNED_OVER),
    conditionChecks: keepKnown(dto.intake_condition_checklist, CONDITION_CHECKS),
    photos: (extras.photos ?? []).map(toTicketPhoto),

    estimatedCost,
    approvedAmount,
    laborCharge,
    partsTotal,
    totalDue,
    amountPaid,
    balance: serverBalance ?? money(Math.max(0, totalDue - amountPaid)),

    promisedAt: promisedAtFrom(dto.promised_date),
    warrantyDays: dto.warranty_days_offered ?? 0,
    technicianId: dto.assigned_technician?.ulid,

    diagnosis: undefined,
    rootCause: undefined,
    partsUsed,
    quoteState: quoteStateFrom(dto, extras.quotes),
    quoteSentAt: extras.quotes?.[0]?.sent_at ?? undefined,
    quoteRepliedAt: extras.quotes?.[0]?.responded_at ?? undefined,

    payments,
    warranty: undefined,
    parentTicketId: undefined,
    isWarrantyClaim: false,

    termsAcceptedAt: dto.terms_accepted_at ?? dto.created_at ?? "",
    createdAt: dto.created_at ?? new Date().toISOString(),
    createdBy: "",
    updatedAt: dto.updated_at ?? dto.created_at ?? new Date().toISOString(),
    /* No status_changed_at on the wire: a transition is what touches the row. */
    statusChangedAt: dto.updated_at ?? dto.created_at ?? new Date().toISOString(),
    releasedAt: status === "released" ? (dto.updated_at ?? undefined) : undefined,
  };
}

function quoteStateFrom(
  dto: RepairTicketDto,
  quotes: TicketQuoteDto[] | undefined,
): QuoteState {
  const latest = quotes?.[0];
  if (latest) {
    if (latest.decision === "approved") return "approved";
    if (latest.decision === "declined") return "declined";
    if (latest.sent_at) return "sent";
  }
  if (dto.approved_amount !== null && dto.approved_amount !== undefined) {
    return "approved";
  }
  return dto.status === "awaiting_approval" ? "sent" : "none";
}

export function toTicketPhoto(dto: TicketPhotoDto): TicketPhoto {
  const stage: TicketPhoto["stage"] =
    dto.phase === "release" ? "release" : dto.phase === "repair" ? "repair" : "intake";
  return {
    id: dto.ulid,
    url: dto.url ?? "",
    caption: undefined,
    stage,
    takenAt: dto.captured_at ?? new Date().toISOString(),
  };
}

/* ── Timeline ────────────────────────────────────────────────────────── */

const EVENT_TYPE_MAP: Record<string, TimelineEventType> = {
  ticket_created: "created",
  ticket_updated: "note",
  status_changed: "status_changed",
  assigned: "assigned",
  note: "note",
  quote_sent: "quote_sent",
  quote_responded: "quote_replied",
  line_added: "part_consumed",
  photo_added: "photo_added",
  payment_recorded: "payment",
  released: "released",
};

export function toTimelineEvent(
  dto: TicketEventDto,
  ticketId: string,
  index: number,
): TimelineEvent {
  const type = EVENT_TYPE_MAP[dto.event_type] ?? "note";
  return {
    /* The events endpoint returns no id, so build a stable one from position. */
    id: `${ticketId}-evt-${index}-${dto.created_at ?? ""}`,
    ticketId,
    type,
    message: eventMessage(dto),
    actorId: dto.actor?.ulid ?? "",
    at: dto.created_at ?? new Date().toISOString(),
    meta: {
      from: dto.from_status ?? null,
      to: dto.to_status ?? null,
      actorName: dto.actor?.name ?? null,
    },
  };
}

/** The wire carries codes; the timeline is read by people. */
function eventMessage(dto: TicketEventDto): string {
  const words = (value: string | null | undefined) =>
    (value ?? "").replace(/_/g, " ");

  if (dto.note?.trim()) return dto.note.trim();

  switch (dto.event_type) {
    case "ticket_created":
      return "Job order opened at the counter.";
    case "ticket_updated":
      return "Job order details updated.";
    case "status_changed":
      return dto.from_status
        ? `Moved from ${words(dto.from_status)} to ${words(dto.to_status)}.`
        : `Moved to ${words(dto.to_status)}.`;
    default:
      return words(dto.event_type) || "Updated.";
  }
}

/* ── Catalog and stock ───────────────────────────────────────────────── */

export function toInventoryItem(dto: ProductDto): InventoryItem {
  const itemClass =
    dto.type === "handset" ? "handset" : dto.type === "part" ? "spare_part" : "accessory";

  return {
    id: dto.ulid,
    itemClass,
    sku: dto.sku,
    name: dto.name,
    brand: dto.brand?.name ?? "",
    category: dto.category?.name ?? "Uncategorised",
    barcode: dto.barcode ?? undefined,
    supplierId: undefined,
    /* Stock levels have no endpoint yet — the ledger is a later API stage. */
    quantityOnHand: 0,
    reorderPoint: dto.reorder_point ?? 0,
    /* `cost` is permission-gated server-side: absent for a cashier. */
    unitCost: num(dto.cost),
    sellingPrice: num(dto.selling_price),
    units: itemClass === "handset" ? [] : undefined,
    compatibleModels:
      itemClass === "spare_part"
        ? (dto.compatible_device_models ?? []).map((model) => model.name)
        : undefined,
    location: undefined,
    active: dto.is_active ?? true,
    createdAt: dto.created_at ?? new Date().toISOString(),
    lastMovementAt: undefined,
  };
}

export function toServiceItem(dto: ServiceDto): ServiceItem {
  return {
    id: dto.ulid,
    code: dto.ulid.slice(-6).toUpperCase(),
    name: dto.name,
    category: dto.category ?? "Service",
    standardPrice: num(dto.default_price),
    estimatedMinutes: dto.default_duration_minutes ?? 30,
    warrantyDays: dto.warranty_days ?? 0,
    active: dto.is_active ?? true,
  };
}

export function toShopProfile(dto: BranchDto, fallback: ShopProfile): ShopProfile {
  return {
    ...fallback,
    name: dto.name ?? fallback.name,
    addressLine:
      [dto.address?.line1, dto.address?.line2].filter(Boolean).join(", ") ||
      fallback.addressLine,
    city:
      [dto.address?.city, dto.address?.province].filter(Boolean).join(", ") ||
      fallback.city,
    mobile: dto.contact_phone ?? fallback.mobile,
    email: dto.contact_email ?? fallback.email,
    vatRegistered: dto.vat_registered ?? fallback.vatRegistered,
    tin: dto.tin ?? fallback.tin,
    birPermitNo: dto.bir_permit_no ?? fallback.birPermitNo,
    receiptFooter: dto.receipt_footer_text ?? fallback.receiptFooter,
  };
}

export function toBranchProfile(dto: BranchDto): BranchProfile {
  return {
    id: dto.ulid,
    name: dto.name ?? "",
    code: dto.code ?? "",
    legalName: dto.legal_name ?? "",
    addressLine1: dto.address?.line1 ?? "",
    addressLine2: dto.address?.line2 ?? "",
    city: dto.address?.city ?? "",
    province: dto.address?.province ?? "",
    postalCode: dto.address?.postal_code ?? "",
    contactPhone: dto.contact_phone ?? "",
    contactEmail: dto.contact_email ?? "",
    tin: dto.tin ?? "",
    birPermitNo: dto.bir_permit_no ?? "",
    vatRegistered: dto.vat_registered ?? false,
    receiptHeaderText: dto.receipt_header_text ?? "",
    receiptFooterText: dto.receipt_footer_text ?? "",
    timezone: dto.timezone ?? "Asia/Manila",
  };
}

/**
 * A branch as the switcher needs it. `type` is the server's word; when it is
 * missing we fall back to `offers_repairs`, and if that is missing too we
 * assume a full repair branch — the safe reading, since it hides nothing.
 */
/**
 * `GET /dashboard` → the day sheet's figures.
 *
 * Money arrives as a decimal string; `stock_value` is simply absent for a
 * caller without `reports.margin.view`, which becomes null rather than 0 —
 * the screen then omits the figure instead of claiming an empty stockroom.
 * `byStatus` stays empty here: the endpoint reports totals, and the board's
 * own column counts come from `/tickets/board`.
 */
export function toDashboardSummary(
  dto: DashboardDto,
  board?: BoardDto | null,
): DashboardSummary {
  const metrics = (m: DashboardMetricsDto | null | undefined) => ({
    todaySales: num(m?.sales?.gross_today),
    todaySaleCount: Math.trunc(num(m?.sales?.count_today)),
    openTickets: Math.trunc(num(m?.repairs?.open)),
    readyForPickup: Math.trunc(num(m?.repairs?.ready_for_pickup)),
    awaitingApproval: Math.trunc(num(m?.repairs?.awaiting_approval)),
    unclaimed: Math.trunc(num(m?.repairs?.unclaimed)),
    lowStock: Math.trunc(num(m?.inventory?.low_stock_items)),
    stockValue:
      m?.inventory?.stock_value == null ? null : num(m.inventory.stock_value),
  });

  return {
    ...metrics(dto.totals),
    /* `/dashboard` reports totals only; lateness and the per-status split come
       from the board, whose cards are the whole open set. Without it both stay
       at zero rather than being guessed from the local cache. */
    byStatus: (board?.columns ?? []).flatMap((column) =>
      /* An exact match, not `toTicketStatus`: that falls back to "received",
         which would file an unknown column under a real status. */
      (TICKET_STATUSES as string[]).includes(column.status)
        ? [
            {
              status: column.status as TicketStatus,
              count: Math.trunc(num(column.count)),
            },
          ]
        : [],
    ),
    overdue: (board?.columns ?? []).reduce(
      (total, column) =>
        total + (column.tickets ?? []).filter((card) => card.is_overdue).length,
      0,
    ),
    cashOnHand: null,
    openShiftId: null,
    branches: (dto.branches ?? []).map((row) => ({
      id: row.ulid,
      name: row.name ?? "",
      code: row.code ?? "",
      offersRepairs: row.offers_repairs ?? row.type !== "sales_only",
      ...metrics(row.metrics),
    })),
  };
}

export function toBranchSummary(dto: BranchDto): BranchSummary {
  const offersRepairs = dto.offers_repairs ?? dto.type !== "sales_only";
  return {
    id: dto.ulid,
    name: dto.name ?? "",
    code: dto.code ?? "",
    kind: dto.type === "sales_only" ? "sales_only" : "repair_and_sales",
    offersRepairs,
    active: dto.is_active ?? true,
  };
}

export function toShopSetting(dto: SettingDto): ShopSetting {
  return {
    key: dto.key,
    value: dto.value,
    type: dto.type,
    source: dto.source === "branch" ? "branch" : "global",
    overridable: dto.overridable ?? true,
  };
}

export function toMessageTemplate(dto: MessageTemplateDto): MessageTemplate {
  return {
    id: dto.ulid,
    channel: dto.channel,
    /* Passed through rather than narrowed: a hook added server-side should
       still show, keyed by its raw name, instead of dropping out. */
    eventKey: dto.event_key as MessageEventKey,
    body: dto.body,
    active: dto.is_active ?? true,
    mergeFields: dto.merge_fields ?? mergeFieldsOf(dto.body),
  };
}

/** Fallback when the server does not echo `merge_fields`: read them off the body. */
export function mergeFieldsOf(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function deviceModelLabel(dto: DeviceModelDto): string {
  return [dto.brand?.name, dto.name].filter(Boolean).join(" ");
}

export function customerDeviceLabel(dto: CustomerDeviceDto): string {
  return [dto.device_model?.brand?.name, dto.device_model?.name, dto.color]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The server enums are authoritative; anything unrecognised is passed through
 * rather than dropped, so a value added server-side shows as its raw key
 * instead of vanishing from a technician's record.
 */
export function toRepairFinding(dto: RepairFindingDto): RepairFinding {
  return {
    id: dto.ulid,
    summary: dto.summary,
    details: dto.details ?? undefined,
    rootCause: dto.root_cause as RepairFinding["rootCause"],
    defects: (dto.defects ?? []) as RepairFinding["defects"],
    resolution: dto.resolution as RepairFinding["resolution"],
    technicianNotes: dto.technician_notes ?? undefined,
    qcPassed: dto.qc_passed ?? undefined,
    qcCheckedAt: dto.qc_checked_at ?? undefined,
    qcCheckedBy: dto.qc_checked_by?.ulid,
    recordedBy: dto.recorded_by?.ulid ?? "",
    createdAt: dto.created_at ?? new Date().toISOString(),
    updatedAt: dto.updated_at ?? dto.created_at ?? new Date().toISOString(),
  };
}
