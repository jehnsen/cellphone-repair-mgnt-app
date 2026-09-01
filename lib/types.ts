/**
 * Domain model for the shop. Every mock accessor and every component reads
 * these types; a real API only has to satisfy them.
 *
 * Money: pesos as `number`, rounded to 2 decimals at write time via
 * `money()` in lib/format.ts. Never format inside the model.
 * Dates: ISO-8601 strings. Rendered in Asia/Manila at the edge.
 */

export type ID = string;
export type ISODate = string;

/* ── People and access ──────────────────────────────────────────────── */

export type Role = "owner" | "manager" | "cashier" | "technician";

export type Permission =
  | "ticket.create"
  | "ticket.edit"
  | "ticket.assign"
  | "ticket.release"
  | "ticket.void"
  | "quote.send"
  | "margin.view"
  | "inventory.view"
  | "inventory.receive"
  | "inventory.adjust"
  | "inventory.price"
  | "pos.sell"
  | "pos.discount.override"
  | "pos.return"
  | "shift.open"
  | "shift.close"
  | "reports.view"
  | "reports.financial"
  | "settings.manage"
  | "users.manage";

export interface User {
  id: ID;
  name: string;
  initials: string;
  role: Role;
  /** The sign-in identity — what `/auth/token` takes as the "username". */
  email?: string;
  mobile?: string;
  active: boolean;
  /** Technicians appear on the board and in throughput reports. */
  isTechnician: boolean;
}

/* ── Customers ──────────────────────────────────────────────────────── */

export interface Customer {
  id: ID;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  /** Captured once, reused on every senior/PWD discount. */
  seniorPwdId?: string;
  seniorPwdType?: "senior" | "pwd";
  notes?: string;
  createdAt: ISODate;
}

/* ── Store credit ──────────────────────────────────────────────────────
   A shop-wide balance the customer can spend as tender. It moves on
   `store_credit` refunds (a credit), `store_credit` payments (a debit),
   and the manual manager/owner adjustment. */

export type StoreCreditSource = "refund" | "payment" | "adjustment" | "other";

export interface StoreCreditEntry {
  id: ID;
  /** `credit` adds to the balance, `debit` takes from it. */
  direction: "credit" | "debit";
  /** Always positive — the sign is carried by `direction`. */
  amount: number;
  /** Running balance after this entry, when the server reports it. */
  balanceAfter?: number;
  reason: string;
  /** What moved the money: a refund, a payment, or a hand adjustment. */
  source: StoreCreditSource;
  /** Sale number, refund number, or whatever the server attached. */
  reference?: string;
  at: ISODate;
  /** Who made the entry, for adjustments. */
  by?: string;
}

export interface StoreCredit {
  customerId: ID;
  balance: number;
  /** Most recent first. Not the whole history — the latest entries. */
  ledger: StoreCreditEntry[];
}

/* ── Devices ────────────────────────────────────────────────────────── */

export type DeviceType = "phone" | "tablet" | "smartwatch" | "laptop";

export type UnlockMethod = "pin" | "pattern" | "password" | "none";

export interface DeviceInfo {
  type: DeviceType;
  brand: string;
  model: string;
  color: string;
  /** IMEI for phones, serial for everything else. Barcode-scannable. */
  imei: string;
  unlockMethod: UnlockMethod;
  /** PIN/password value, or pattern as dot indices: "0-1-2-5-8". */
  unlockValue?: string;
}

/* ── Device reference data ─────────────────────────────────────────────
   The brand and model lists behind the intake pickers, editable under
   Settings. `DeviceCatalog` (in the contract) is the active-only, flat
   read of the same rows the pickers use; these carry the full record. */

export interface DeviceBrand {
  id: ID;
  name: string;
  active: boolean;
}

export interface DeviceModel {
  id: ID;
  name: string;
  brandId: ID;
  /** Denormalised for the list; the set is small enough to carry it. */
  brandName: string;
  releaseYear?: number;
  active: boolean;
}

export type TurnedOverAccessory = "sim" | "sd_card" | "case" | "charger" | "box";

export type ConditionCheck =
  | "screen_cracked"
  | "back_cracked"
  | "dents"
  | "scratches"
  | "water_indicator"
  | "missing_screws"
  | "prior_repair"
  | "powers_on"
  | "buttons_ok"
  | "camera_ok";

export interface TicketPhoto {
  id: ID;
  /** Object URL in mock land; a CDN URL once a backend exists. */
  url: string;
  caption?: string;
  stage: "intake" | "release" | "repair";
  takenAt: ISODate;
}

/* ── Repair tickets ─────────────────────────────────────────────────── */

export type TicketStatus =
  | "received"
  | "diagnosed"
  | "awaiting_approval"
  | "awaiting_parts"
  | "in_repair"
  | "qc"
  | "ready_for_pickup"
  | "released"
  | "unrepairable"
  | "returned_as_is"
  | "unclaimed";

export type ProblemTag =
  | "screen"
  | "battery"
  | "charging_port"
  | "water_damage"
  | "no_power"
  | "software"
  | "camera"
  | "speaker"
  | "board_level";

export type QuoteState = "none" | "sent" | "approved" | "declined";

export interface PartConsumption {
  id: ID;
  /** References an InventoryItem of class "spare_part". */
  itemId: ID;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  /** What the customer is charged for the part. */
  unitPrice: number;
  consumedAt: ISODate;
  consumedBy: ID;
}

export type PaymentMethod =
  | "cash"
  | "gcash"
  | "maya"
  | "card"
  | "bank_transfer"
  | "trade_in";

export interface Payment {
  id: ID;
  amount: number;
  method: PaymentMethod;
  /** GCash/Maya reference no., card auth code, bank reference. */
  reference?: string;
  kind: "downpayment" | "balance" | "full" | "refund";
  receivedAt: ISODate;
  receivedBy: ID;
  shiftId?: ID;
}

export type TimelineEventType =
  | "created"
  | "status_changed"
  | "assigned"
  | "note"
  | "quote_sent"
  | "quote_replied"
  | "part_consumed"
  | "payment"
  | "photo_added"
  | "notified"
  | "released"
  | "warranty_claim";

export interface TimelineEvent {
  id: ID;
  ticketId: ID;
  type: TimelineEventType;
  /** Plain sentence, already written for a human. */
  message: string;
  actorId: ID;
  at: ISODate;
  meta?: Record<string, string | number | boolean | null>;
}

/* ── Repair findings ────────────────────────────────────────────────── */

/**
 * What was actually wrong with the unit, and what was done about it.
 *
 * Deliberately a controlled vocabulary rather than free text: this is what
 * makes "how often is it the charging port on this model?" answerable. See
 * docs/backend-findings-spec.md — these values mirror the server enums, which
 * are the source of truth.
 */

/** Why it failed. One per job. */
export type RootCause =
  | "drop_impact"
  | "liquid_ingress"
  | "component_wear"
  | "power_surge"
  | "third_party_repair"
  | "firmware_corruption"
  | "manufacturing_defect"
  | "user_error"
  | "no_fault_found"
  | "other";

/** Which components were faulty. Zero or more. */
export type DefectArea =
  | "screen"
  | "digitizer"
  | "battery"
  | "charging_port"
  | "motherboard"
  | "power_ic"
  | "camera_rear"
  | "camera_front"
  | "speaker"
  | "earpiece"
  | "microphone"
  | "buttons"
  | "back_cover"
  | "housing"
  | "sim_reader"
  | "sd_reader"
  | "wifi_antenna"
  | "other";

/** What was done. */
export type Resolution =
  | "repaired"
  | "part_replaced"
  | "cleaned"
  | "software_restored"
  | "no_fault_found"
  | "unrepairable"
  | "customer_declined";

export interface RepairFinding {
  /** One record per ticket, so this is stable across edits. */
  id: ID;
  summary: string;
  details?: string;
  rootCause: RootCause;
  defects: DefectArea[];
  resolution: Resolution;
  technicianNotes?: string;
  /** Null until the unit has been bench-tested after the work. */
  qcPassed?: boolean;
  qcCheckedAt?: ISODate;
  qcCheckedBy?: ID;
  recordedBy: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface WarrantySlip {
  claimCode: string;
  scope: string;
  periodDays: number;
  startsAt: ISODate;
  expiresAt: ISODate;
  exclusions: string[];
}

export interface Ticket {
  id: ID;
  /** JO-YYYYMM-#### */
  ticketNo: string;
  /** Short code printed on the claim stub and scanned at release. */
  claimCode: string;
  status: TicketStatus;
  customerId: ID;
  device: DeviceInfo;
  reportedProblem: string;
  problemTags: ProblemTag[];
  turnedOver: TurnedOverAccessory[];
  conditionChecks: ConditionCheck[];
  photos: TicketPhoto[];

  /* Commercials */
  estimatedCost: number;
  /** Set once a quote is approved; locked from then on. */
  approvedAmount?: number;
  laborCharge: number;
  partsTotal: number;
  /** What the customer owes in total: estimate → approved → actual. */
  totalDue: number;
  amountPaid: number;
  balance: number;

  promisedAt: ISODate;
  warrantyDays: number;
  technicianId?: ID;

  /* Work */
  /** @deprecated Superseded by `finding`. Kept while the API still lacks the
   *  findings endpoint; nothing writes these. */
  diagnosis?: string;
  rootCause?: string;
  /** The structured conclusion. Absent until a technician records one. */
  finding?: RepairFinding;
  partsUsed: PartConsumption[];
  quoteState: QuoteState;
  quoteSentAt?: ISODate;
  quoteRepliedAt?: ISODate;

  payments: Payment[];
  warranty?: WarrantySlip;

  /** Warranty rework: a no-charge child ticket linked to its parent. */
  parentTicketId?: ID;
  isWarrantyClaim: boolean;

  termsAcceptedAt: ISODate;
  createdAt: ISODate;
  createdBy: ID;
  updatedAt: ISODate;
  statusChangedAt: ISODate;
  releasedAt?: ISODate;
  releasedBy?: ID;
  releasedTo?: string;
}

/* ── Inventory ──────────────────────────────────────────────────────── */

export type ItemClass = "handset" | "accessory" | "spare_part";

export type HandsetCondition =
  | "brand_new"
  | "open_box"
  | "secondhand"
  | "refurbished";

export type HandsetUnitStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "for_repair"
  | "returned";

/** One physical handset, tracked by IMEI. Handsets are never a quantity. */
export interface HandsetUnit {
  id: ID;
  itemId: ID;
  imei: string;
  condition: HandsetCondition;
  status: HandsetUnitStatus;
  cost: number;
  price: number;
  storage?: string;
  color?: string;
  batteryHealth?: number;
  warrantyDays: number;
  supplierId?: ID;
  receivedAt: ISODate;
  soldAt?: ISODate;
  saleId?: ID;
  /** Set when the unit came in as a trade-in on a sale. */
  fromTradeIn?: boolean;
  notes?: string;
}

export interface InventoryItem {
  id: ID;
  itemClass: ItemClass;
  sku: string;
  name: string;
  brand: string;
  category: string;
  barcode?: string;
  supplierId?: ID;

  /** accessory + spare_part only. Handset stock is units.length. */
  quantityOnHand: number;
  reorderPoint: number;
  unitCost: number;
  sellingPrice: number;

  /** handset only. */
  units?: HandsetUnit[];
  /** spare_part only: lets a technician filter by the device on the ticket. */
  compatibleModels?: string[];

  location?: string;
  active: boolean;
  createdAt: ISODate;
  lastMovementAt?: ISODate;
}

export type MovementReason =
  | "receiving"
  | "sale"
  | "repair_consumption"
  | "return_customer"
  | "return_supplier"
  | "damaged"
  | "lost"
  | "count_correction"
  | "trade_in"
  | "reserved"
  | "unreserved";

export interface StockMovement {
  id: ID;
  itemId: ID;
  unitId?: ID;
  /** Signed: +5 received, -1 consumed. */
  quantity: number;
  reason: MovementReason;
  /** Delivery receipt no., ticket no., or sale no. */
  reference?: string;
  ticketId?: ID;
  saleId?: ID;
  unitCost?: number;
  note?: string;
  at: ISODate;
  by: ID;
}

export interface Supplier {
  id: ID;
  name: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  address?: string;
  terms?: string;
  active: boolean;
}

/* ── Point of sale ──────────────────────────────────────────────────── */

export type SaleLineKind = "handset" | "accessory" | "service";

export interface Discount {
  kind: "percent" | "amount";
  value: number;
  label?: string;
}

export interface SaleLine {
  id: ID;
  kind: SaleLineKind;
  itemId?: ID;
  /** handset lines must name the exact unit. */
  unitId?: ID;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount?: Discount;
  lineTotal: number;
}

export interface SalePayment {
  id: ID;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  /** cash only */
  tendered?: number;
  change?: number;
  /** trade_in only: the unit created by taking the device in. */
  tradeInUnitId?: ID;
}

export type SaleStatus =
  | "completed"
  | "returned"
  | "partially_returned"
  | "void";

export interface Sale {
  id: ID;
  /** SI-YYYYMM-#### */
  saleNo: string;
  /** Typed in by staff off the BIR-registered pad. We never mint one. */
  officialReceiptNo?: string;
  customerId?: ID;
  lines: SaleLine[];
  subtotal: number;
  orderDiscount?: Discount;
  /** Statutory senior/PWD relief — computed, not typed. */
  seniorPwdDiscount?: {
    idNumber: string;
    type: "senior" | "pwd";
    name: string;
    /** Persons the discount applies to on this sale. */
    beneficiaries: number;
    vatExemptSales: number;
    discountAmount: number;
  };
  vatableSales: number;
  vatExemptSales: number;
  vatAmount: number;
  zeroRatedSales: number;
  totalDue: number;
  payments: SalePayment[];
  status: SaleStatus;
  cashierId: ID;
  shiftId: ID;
  soldAt: ISODate;
  note?: string;
}

export type ReturnReason =
  | "defective"
  | "wrong_item"
  | "customer_changed_mind"
  | "warranty";

export interface SaleReturn {
  id: ID;
  returnNo: string;
  saleId: ID;
  lines: { saleLineId: ID; quantity: number; refund: number }[];
  reason: ReturnReason;
  /** Defective stock comes back flagged, not straight to sellable. */
  restock: boolean;
  refundMethod: PaymentMethod;
  totalRefund: number;
  at: ISODate;
  by: ID;
  note?: string;
}

/* ── Cash drawer ────────────────────────────────────────────────────── */

export interface CashMovement {
  id: ID;
  shiftId: ID;
  kind: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  at: ISODate;
  by: ID;
}

export interface Shift {
  id: ID;
  shiftNo: string;
  openedBy: ID;
  openedAt: ISODate;
  startingCash: number;
  closedBy?: ID;
  closedAt?: ISODate;
  countedCash?: number;
  expectedCash?: number;
  variance?: number;
  movements: CashMovement[];
  note?: string;
  status: "open" | "closed";
}

/* ── Settings ───────────────────────────────────────────────────────── */

export interface ServiceItem {
  id: ID;
  code: string;
  name: string;
  category: string;
  standardPrice: number;
  estimatedMinutes: number;
  warrantyDays: number;
  active: boolean;
}

export interface WarrantyTemplate {
  id: ID;
  name: string;
  periodDays: number;
  scope: string;
  exclusions: string[];
  isDefault: boolean;
}

export type MessageChannel = "viber" | "sms" | "email";

/**
 * A lifecycle hook a template can be attached to. One template per hook per
 * channel — `(channel, eventKey)` is unique.
 */
export type MessageEventKey =
  | "ticket.received"
  | "ticket.ready_for_pickup"
  | "ticket.released"
  | "ticket.unclaimed_30"
  | "ticket.unclaimed_60"
  | "ticket.unclaimed_90"
  | "quote.sent"
  | "warranty.expiring_soon"
  | "installment.due_reminder"
  | "installment.overdue";

export interface MessageTemplate {
  id: ID;
  channel: MessageChannel;
  eventKey: MessageEventKey;
  body: string;
  /** A retired template is inactive — there is no delete. */
  active: boolean;
  /** `{{merge_field}}` names parsed out of the body by the server. */
  mergeFields: string[];
}

export type SettingType = "string" | "int" | "decimal" | "bool" | "json";
export type SettingSource = "branch" | "global";

/**
 * One branch-scoped config entry, already resolved against the shop-wide
 * default: `value` is what is in effect, `source` says whether this branch
 * overrode it or is inheriting.
 */
export interface ShopSetting {
  key: string;
  value: string | number | boolean | null | Record<string, unknown> | unknown[];
  type: SettingType;
  source: SettingSource;
  /** False when this branch is not allowed to override the key. */
  overridable: boolean;
}

export interface ShopProfile {
  name: string;
  addressLine: string;
  city: string;
  mobile: string;
  email?: string;
  /** VAT registration changes receipt layout and discount computation. */
  vatRegistered: boolean;
  vatRate: number;
  /** Show the BIR registration block on printed documents. */
  showBirDetails: boolean;
  tin?: string;
  birPermitNo?: string;
  serialNo?: string;
  receiptFooter: string;
  /** Days past the promised date before a ticket is flagged unclaimed. */
  unclaimedAfterDays: number;
}

/**
 * The branch's own editable identity, as stored on the `branches` table —
 * distinct from `ShopProfile` (a lossy view of the same row that receipts and
 * POS read). This one round-trips every field the settings form edits, so
 * nothing is dropped between load and save. `code` and `timezone` are shown
 * but not editable here.
 */
export interface BranchProfile {
  id: ID;
  name: string;
  code: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  contactPhone: string;
  contactEmail: string;
  tin: string;
  birPermitNo: string;
  vatRegistered: boolean;
  receiptHeaderText: string;
  receiptFooterText: string;
  timezone: string;
}

/* ── Cross-cutting ──────────────────────────────────────────────────── */

export interface AppNotification {
  id: ID;
  ticketId?: ID;
  customerId: ID;
  channel: "sms" | "viber";
  body: string;
  /** Nothing is sent — this is the outbox a backend would drain. */
  state: "queued" | "sent" | "failed";
  queuedAt: ISODate;
}

/** Shape every list accessor returns, so screens can render three states. */
export interface Paged<T> {
  rows: T[];
  total: number;
}

/** The whole mock database, so a backend team can see the surface at once. */
export interface Database {
  users: User[];
  customers: Customer[];
  tickets: Ticket[];
  timeline: TimelineEvent[];
  items: InventoryItem[];
  movements: StockMovement[];
  suppliers: Supplier[];
  sales: Sale[];
  returns: SaleReturn[];
  shifts: Shift[];
  services: ServiceItem[];
  warrantyTemplates: WarrantyTemplate[];
  messageTemplates: MessageTemplate[];
  notifications: AppNotification[];
  shop: ShopProfile;
}
