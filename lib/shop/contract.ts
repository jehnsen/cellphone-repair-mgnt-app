import type {
  BranchProfile,
  ConditionCheck,
  Customer,
  DefectArea,
  DeviceInfo,
  Discount,
  HandsetCondition,
  HandsetUnitStatus,
  ID,
  InventoryItem,
  ItemClass,
  MessageChannel,
  MessageEventKey,
  MessageTemplate,
  MovementReason,
  Payment,
  PaymentMethod,
  ProblemTag,
  RepairFinding,
  Resolution,
  RootCause,
  Sale,
  SaleLineKind,
  SettingType,
  Shift,
  ShopSetting,
  StockMovement,
  Supplier,
  Ticket,
  TicketPhoto,
  TicketStatus,
  TimelineEvent,
  TurnedOverAccessory,
  User,
} from "@/lib/types";
import type {
  CustomerQuery,
  ItemQuery,
  SaleQuery,
  TicketQuery,
} from "@/lib/shop/queries";

/**
 * The contract every screen codes against.
 *
 * There is exactly one implementation now — the Laravel API (`lib/api/`) —
 * plus a stub for the contexts the API has not built yet, which answers
 * honestly instead of inventing rows. Nothing in this file knows about HTTP.
 */

/* ── Inputs ──────────────────────────────────────────────────────────── */

export interface NewTicketInput {
  customerId?: ID;
  newCustomer?: { name: string; mobile: string; email?: string };
  device: DeviceInfo;
  reportedProblem: string;
  problemTags: ProblemTag[];
  turnedOver: TurnedOverAccessory[];
  conditionChecks: ConditionCheck[];
  photos: TicketPhoto[];
  estimatedCost: number;
  downpayment: number;
  downpaymentMethod: Payment["method"];
  promisedAt: string;
  warrantyDays: number;
  technicianId?: ID;
  createdBy: ID;
}

export interface NewSaleInput {
  customerId?: ID;
  lines: {
    kind: SaleLineKind;
    /** Omitted for ad-hoc service lines. */
    itemId?: ID;
    /** Handset lines must name the exact unit. */
    unitId?: ID;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    discount?: Discount;
  }[];
  orderDiscount?: Discount;
  /** Statutory relief. The ID is captured on the sale, not just the customer. */
  seniorPwd?: {
    idNumber: string;
    type: "senior" | "pwd";
    name: string;
    beneficiaries: number;
  };
  payments: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    tendered?: number;
  }[];
  officialReceiptNo?: string;
  note?: string;
  cashierId: ID;
}

/** A new catalog row. Stock arrives separately, through receiving. */
export interface NewItemInput {
  name: string;
  sku: string;
  itemClass: ItemClass;
  categoryId: ID;
  brandId?: ID;
  barcode?: string;
  unitCost: number;
  sellingPrice: number;
  reorderPoint: number;
}

/** The picker lists behind the new-item form. */
export interface ProductRefs {
  categories: { id: ID; name: string }[];
  brands: { id: ID; name: string }[];
}

export interface ReceiveStockInput {
  itemId: ID;
  /** accessory + spare_part. Handsets are received as units instead. */
  quantity?: number;
  /** handset only: one row per physical unit, each with its own IMEI. */
  units?: {
    imei: string;
    condition: HandsetCondition;
    cost: number;
    price: number;
    storage?: string;
    color?: string;
    warrantyDays: number;
  }[];
  unitCost?: number;
  supplierId?: ID;
  /** Delivery receipt number. */
  reference?: string;
  note?: string;
  userId: ID;
}

export interface AdjustStockInput {
  itemId: ID;
  /** Signed: -2 damaged, +1 found on a recount. Ignored for handset units. */
  quantity?: number;
  /** handset only: retire or restore one unit. */
  unitId?: ID;
  unitStatus?: HandsetUnitStatus;
  reason: Extract<
    MovementReason,
    "damaged" | "lost" | "count_correction" | "return_supplier" | "return_customer"
  >;
  note?: string;
  userId: ID;
}

export interface DashboardSummary {
  todaySales: number;
  todaySaleCount: number;
  openTickets: number;
  byStatus: { status: TicketStatus; count: number }[];
  overdue: number;
  readyForPickup: number;
  lowStock: number;
  cashOnHand: number | null;
  openShiftId: ID | null;
  unclaimed: number;
  awaitingApproval: number;
}

export interface SaveFindingInput {
  ticketId: ID;
  summary: string;
  details?: string;
  rootCause: RootCause;
  defects: DefectArea[];
  resolution: Resolution;
  technicianNotes?: string;
  qcPassed?: boolean;
  actorId: ID;
}

/**
 * The server's own reporting, kept separate from `ShopApi`.
 *
 * These figures are computed in SQL over the whole shop, so they are the
 * numbers of record — screens must not re-derive them from the browser cache.
 * Implemented by `lib/api/live-reports.ts`.
 */
export interface ReportRange {
  from?: string;
  to?: string;
  days?: number;
}

/**
 * Revenue split by what was sold. The reports screen plots these as three
 * series, so the split has to come from the same SQL as the totals — deriving
 * it from cached sale lines is what this interface exists to avoid.
 *
 * A server that does not break sales down this way reports the whole day under
 * `repair` and the chart still sums correctly; see `splitOf` in
 * `lib/api/live-reports.ts`.
 */
export interface RevenueSplit {
  repair: number;
  handset: number;
  accessory: number;
}

export interface ShopReports {
  getSalesReport(range?: ReportRange): Promise<{
    grossSales: number;
    discountTotal: number;
    vatTotal: number;
    saleCount: number;
    /** Totals for the whole range, split the same way as `byDay`. */
    totals: RevenueSplit;
    byDay: ({ date: string; saleCount: number; grossSales: number } & RevenueSplit)[];
  }>;

  getMarginReport(range?: ReportRange): Promise<{
    revenue: number;
    cogs: number;
    grossMargin: number;
  }>;

  getTechnicianThroughput(range?: ReportRange): Promise<
    { technician: string; ticketCount: number; averageTurnaroundHours: number }[]
  >;

  getMostRepairedModels(range?: ReportRange): Promise<
    { model: string; ticketCount: number }[]
  >;

  getInventoryValuation(): Promise<{
    totalCostValue: number;
    totalRetailValue: number;
    skuCount: number;
    rows: {
      product: string;
      onHand: number;
      costValue: number;
      retailValue: number;
    }[];
  }>;

  getDeadStock(days?: number): Promise<
    { product: string; onHand: number; daysChecked: number }[]
  >;

  getUnclaimedAging(): Promise<
    {
      ticketId: string;
      ticketNo: string;
      daysUnclaimed: number;
      /* Enough to render the row without a second lookup. The browser cache
         holds only what has been fetched, and this report is the whole shop. */
      customerName: string;
      device: string;
      status: TicketStatus;
      balance: number;
    }[]
  >;
}

/** Everything a screen can ask of the shop. A fetch client implements this. */
export interface ShopApi {
  getTickets(query?: TicketQuery): Promise<Ticket[]>;
  getTicket(id: ID): Promise<Ticket>;
  findTicketByCode(code: string): Promise<Ticket | null>;
  getTimeline(ticketId: ID): Promise<TimelineEvent[]>;

  getCustomers(query?: CustomerQuery): Promise<Customer[]>;
  getCustomer(id: ID): Promise<Customer>;
  createCustomer(input: Omit<Customer, "id" | "createdAt">): Promise<Customer>;
  updateCustomer(input: { id: ID } & Partial<Omit<Customer, "id" | "createdAt">>): Promise<Customer>;

  getItems(query?: ItemQuery): Promise<InventoryItem[]>;
  getItem(id: ID): Promise<InventoryItem>;
  getMovements(itemId?: ID): Promise<StockMovement[]>;
  getSuppliers(): Promise<Supplier[]>;
  getProductRefs(): Promise<ProductRefs>;
  createItem(input: NewItemInput): Promise<InventoryItem>;
  receiveStock(input: ReceiveStockInput): Promise<InventoryItem>;
  adjustStock(input: AdjustStockInput): Promise<InventoryItem>;

  getSales(query?: SaleQuery): Promise<Sale[]>;
  getSale(id: ID): Promise<Sale>;
  createSale(input: NewSaleInput): Promise<Sale>;

  getUsers(): Promise<User[]>;
  getShifts(): Promise<Shift[]>;
  getOpenShift(): Promise<Shift | null>;
  openShift(input: { startingCash: number; userId: ID }): Promise<Shift>;
  closeShift(input: {
    shiftId: ID;
    countedCash: number;
    userId: ID;
    note?: string;
  }): Promise<Shift>;
  addCashMovement(input: {
    shiftId: ID;
    kind: "cash_in" | "cash_out";
    amount: number;
    reason: string;
    userId: ID;
  }): Promise<Shift>;

  createTicket(input: NewTicketInput): Promise<Ticket>;
  setTicketStatus(input: {
    ticketId: ID;
    status: TicketStatus;
    actorId: ID;
    note?: string;
  }): Promise<Ticket>;
  assignTechnician(input: {
    ticketIds: ID[];
    technicianId: ID;
    actorId: ID;
  }): Promise<Ticket[]>;
  addNote(input: { ticketId: ID; note: string; actorId: ID }): Promise<TimelineEvent>;
  /** Money against a repair. A ticket is never wrapped in a sale to collect. */
  recordPayment(input: {
    ticketId: ID;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    tendered?: number;
    actorId: ID;
  }): Promise<Ticket>;

  /** The structured conclusion. Absent until a technician records one. */
  getFinding(ticketId: ID): Promise<RepairFinding | null>;
  /** Upsert: creates on first save, updates thereafter. */
  saveFinding(input: SaveFindingInput): Promise<RepairFinding>;
  markReadyForPickup(input: { ticketIds: ID[]; actorId: ID }): Promise<Ticket[]>;
  /** Scan-and-match the unit before it leaves. The server refuses a release
   *  without a matching release-phase verification (or an owner override). */
  verifyImei(input: {
    ticketId: ID;
    scannedImei: string;
    phase?: "intake" | "pre_repair" | "post_repair" | "release";
    overrideReason?: string;
  }): Promise<{ matches: boolean }>;

  releaseTicket(input: {
    ticketId: ID;
    releasedTo: string;
    payment?: { amount: number; method: Payment["method"]; reference?: string };
    actorId: ID;
  }): Promise<Ticket>;

  /** Brand and model lists for the intake pickers, from the API catalog. */
  getDeviceCatalog(): Promise<DeviceCatalog>;

  getDashboard(): Promise<DashboardSummary>;

  /* ── Branch profile ──────────────────────────────────────────────
     The caller's own branch row: name, address, contact, TIN, VAT
     registration, and receipt header/footer. These are real columns on
     `branches`, edited here rather than through key/value settings.
     Requires `settings.manage`. */
  getBranch(): Promise<BranchProfile>;
  updateBranch(patch: BranchPatch): Promise<BranchProfile>;

  /* ── Branch settings ──────────────────────────────────────────────
     Key/value config for the caller's own branch, each entry already
     resolved against the shop-wide default. Requires `settings.manage`. */
  getSettings(): Promise<ShopSetting[]>;
  /**
   * Partial bulk upsert. A `null` value clears this branch's override and lets
   * the entry fall back to the shop default; keys left out are untouched.
   */
  updateSettings(patch: SettingPatch): Promise<ShopSetting[]>;

  /* ── Message templates ────────────────────────────────────────────
     Viber/SMS/email copy with `{{merge_field}}` placeholders, keyed by
     (channel, eventKey). Config, not history — retire by deactivating,
     there is no delete. All require `settings.manage`. */
  getMessageTemplates(): Promise<MessageTemplate[]>;
  createMessageTemplate(input: NewMessageTemplateInput): Promise<MessageTemplate>;
  /** Only `body` and `active` are editable — the identity is fixed on create. */
  updateMessageTemplate(input: {
    id: ID;
    body?: string;
    active?: boolean;
  }): Promise<MessageTemplate>;
}

/**
 * A key => value map. A value may also be the tagged form
 * `{ value, type }` to pin the storage type instead of letting it be inferred.
 * `null` removes this branch's override.
 */
export type SettingValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export type SettingPatch = Record<
  string,
  SettingValue | { value: SettingValue; type: SettingType }
>;

export interface NewMessageTemplateInput {
  channel: MessageChannel;
  eventKey: MessageEventKey;
  body: string;
  active?: boolean;
}

/**
 * Every field the branch form can change. All optional — only what is passed
 * is written. `code` and `timezone` are not editable through this screen.
 */
export type BranchPatch = Partial<
  Pick<
    BranchProfile,
    | "name"
    | "legalName"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "province"
    | "postalCode"
    | "contactPhone"
    | "contactEmail"
    | "tin"
    | "birPermitNo"
    | "vatRegistered"
    | "receiptHeaderText"
    | "receiptFooterText"
  >
>;

/** Brand and model reference lists, for the intake form's pickers. */
export interface DeviceCatalog {
  brands: string[];
  models: { brand: string; model: string }[];
}
