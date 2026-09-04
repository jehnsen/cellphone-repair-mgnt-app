import type {
  BranchKind,
  BranchProfile,
  BranchSummary,
  ClaimHandling,
  ClaimResolution,
  Role,
  ConditionCheck,
  Customer,
  DefectArea,
  DeviceBrand,
  DeviceInfo,
  DeviceModel,
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
  Paged,
  ProblemTag,
  RepairFinding,
  Resolution,
  RootCause,
  Sale,
  SaleLineKind,
  SaleWarranty,
  SaleWarrantyClaim,
  SaleWarrantyCoverage,
  ServiceItem,
  SettingType,
  Shift,
  ShopSetting,
  StockMovement,
  StoreCredit,
  Supplier,
  SupplierReturn,
  SupplierReturnOutcome,
  SupplierReturnReason,
  Ticket,
  TicketPhoto,
  TicketStatus,
  TimelineEvent,
  TurnedOverAccessory,
  User,
} from "@/lib/types";
import type {
  ClaimListQuery,
  CustomerQuery,
  ItemQuery,
  SaleQuery,
  SupplierReturnListQuery,
  TicketQuery,
  WarrantyListQuery,
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
    /**
     * Serialized-unit (handset) lines only: override the shop warranty issued
     * at checkout. Omitted, the server falls back to the product's catalog
     * `warranty_days` (0 ⇒ nothing issued). The server ignores it elsewhere.
     */
    warranty?: {
      days: number;
      coverage: SaleWarrantyCoverage;
      terms?: string;
    };
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
    /** `trade_in` only: the completed buy-back acquisition backing this
     *  tender. The server caps the amount at its offered price and refuses
     *  an acquisition that is not completed, is at another branch, or was
     *  already spent (`409 TRADE_IN_NOT_AVAILABLE`). */
    acquisitionUlid?: string;
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

/**
 * Edit an existing catalog row. Only the fields passed are changed; stock is
 * never touched here — that's receiving and adjustment. The item's class
 * (handset vs. accessory vs. part) is fixed once units or quantity exist, so
 * it isn't editable.
 */
export interface UpdateItemInput {
  itemId: ID;
  name?: string;
  sku?: string;
  /** `null` clears it. */
  barcode?: string | null;
  categoryId?: ID;
  /** `null` clears it. */
  brandId?: ID | null;
  unitCost?: number;
  sellingPrice?: number;
  reorderPoint?: number;
  /** Catalog default for the sale warranty issued when a unit sells. */
  warrantyDays?: number;
  active?: boolean;
}

/** A supplier the shop receives stock from. Never deleted — deactivated,
    so past goods receipts and returns keep their supplier. */
export interface NewSupplierInput {
  name: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  terms?: string;
  note?: string;
}

export interface UpdateSupplierInput extends Partial<NewSupplierInput> {
  id: ID;
  active?: boolean;
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
  /**
   * Retail value of stock on hand, or null when the caller lacks
   * `reports.margin.view` — the server sends counts only in that case, so a
   * cashier's dashboard simply omits the figure rather than showing a zero
   * that reads as an empty stockroom.
   */
  stockValue: number | null;
  /**
   * Per-branch split, present only when looking at every branch at once.
   * Empty on a single-branch view.
   */
  branches: DashboardBranchRow[];
}

/** One branch's own figures inside an all-branches dashboard. */
export interface DashboardBranchRow {
  id: ID;
  name: string;
  code: string;
  offersRepairs: boolean;
  todaySales: number;
  todaySaleCount: number;
  openTickets: number;
  readyForPickup: number;
  awaitingApproval: number;
  unclaimed: number;
  lowStock: number;
  stockValue: number | null;
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

/* ── The four counter-finance reports ────────────────────────────────────
   Each server payload is the house shape `{ data: { aggregate, rows },
   meta: { generated_at } }`, money as fixed 2-decimal strings, and is
   branch-scoped through the same `?branch=` param every other GET carries.
   `num()` in `live-reports.ts` coerces the strings; percentages here are
   fractions (0–1), derived from the two authoritative figures rather than
   read off the wire. */

/**
 * Repair P&L — closes the hole that repair-ticket payments never become
 * Sales, so repair labour and parts were invisible in the margin report.
 * Revenue is recognised at release. `paymentsCollected` is the cash actually
 * taken on those tickets: earned vs collected.
 */
export interface RepairPnl {
  partsRevenue: number;
  laborRevenue: number;
  totalRevenue: number;
  /** From `ticket_lines.quantity × unit_cost`. */
  partsCost: number;
  partsMargin: number;
  grossMargin: number;
  /** `grossMargin / totalRevenue`, as a fraction. */
  grossMarginPct: number;
  paymentsCollected: number;
  generatedAt: string;
  /** One row per technician who released work in the window. */
  byTechnician: {
    technician: string;
    partsRevenue: number;
    laborRevenue: number;
    totalRevenue: number;
    partsCost: number;
    grossMargin: number;
    grossMarginPct: number;
    paymentsCollected: number;
  }[];
}

/** A tender method → amount map. The server rolls up all seven methods; the
 *  keys are whatever it returns, so a new method needs no code change here. */
export type TenderTotals = Record<string, number>;

export interface CashReconciliationShift {
  shiftId: string;
  shiftNo: string;
  branch: string;
  cashier: string;
  openedAt: string;
  closedAt: string;
  /** An open shift carries a *live* `expectedCash`; counted and variance are null. */
  open: boolean;
  openingFloat: number;
  cashPayments: number;
  cashIn: number;
  cashOut: number;
  /** `openingFloat + cashPayments + cashIn − cashOut`, the server's own formula. */
  expectedCash: number;
  countedCash: number | null;
  variance: number | null;
  tenderBreakdown: TenderTotals;
}

/**
 * Cash reconciliation / Z-report — one row per shift opened in the window.
 */
export interface CashReconciliation {
  tenderTotals: TenderTotals;
  varianceTotal: number;
  expectedTotal: number;
  countedTotal: number;
  openShiftCount: number;
  generatedAt: string;
  shifts: CashReconciliationShift[];
}

/**
 * Refunds & voids — the leakage the sales report actively hides (it filters
 * `status != voided`). Refunds dated by `refunds.created_at`, voids by the
 * sale's `updated_at` (a void has no timestamp of its own).
 */
export interface RefundsVoids {
  refundTotal: number;
  refundCount: number;
  refundByMethod: { key: string; amount: number; count: number }[];
  refundByReason: { key: string; amount: number; count: number }[];
  voidCount: number;
  voidTotal: number;
  generatedAt: string;
  refunds: {
    id: string;
    saleNo: string;
    at: string;
    amount: number;
    method: string;
    reason: string;
    processor: string;
  }[];
  voids: {
    id: string;
    saleNo: string;
    at: string;
    amount: number;
    voidReason: string;
    processor: string;
  }[];
}

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

/**
 * Receivables aging — every repair ticket still carrying `balance > 0`,
 * bucketed by age. The clock starts at the release-event date, falling back
 * to `promised_date`, then intake; `agingBasis` names which was used.
 * A snapshot as of now — no date window.
 */
export interface ReceivablesAging {
  totalOutstanding: number;
  generatedAt: string;
  buckets: { bucket: AgingBucket; count: number; amount: number }[];
  rows: {
    ticketId: string;
    ticketNo: string;
    customerName: string;
    device: string;
    branch: string;
    balance: number;
    daysOutstanding: number;
    bucket: AgingBucket;
    agingBasis: string;
  }[];
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

  /* ── Counter finance ──────────────────────────────────────────────
     Repair P&L needs `reports.view` + `reports.margin.view`; the other
     three need `reports.view`. All but receivables aging take a date
     window (default 30 days). */
  getRepairPnl(range?: ReportRange): Promise<RepairPnl>;
  getCashReconciliation(range?: ReportRange): Promise<CashReconciliation>;
  getRefundsVoids(range?: ReportRange): Promise<RefundsVoids>;
  getReceivablesAging(): Promise<ReceivablesAging>;
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

  /* ── Store credit ─────────────────────────────────────────────────
     Shop-wide balance plus the most recent ledger entries, newest
     first. Needs `customers.view`. */
  getStoreCredit(customerId: ID): Promise<StoreCredit>;
  /**
   * Manager/owner only (`store_credit.manage`). `credit` grants,
   * `debit` corrects or claws back — a debit past the balance is
   * refused with `422 INSUFFICIENT_STORE_CREDIT`. Refund- and
   * payment-driven movements go through the sales endpoints, not here.
   */
  adjustStoreCredit(input: {
    customerId: ID;
    direction: "credit" | "debit";
    amount: number;
    reason: string;
    actorId: ID;
  }): Promise<StoreCredit>;

  getItems(query?: ItemQuery): Promise<InventoryItem[]>;
  getItem(id: ID): Promise<InventoryItem>;
  getMovements(itemId?: ID): Promise<StockMovement[]>;
  /** Active suppliers only unless `includeInactive` — the receiving picker
      wants the short list, the Settings tab wants everything. */
  getSuppliers(opts?: { includeInactive?: boolean }): Promise<Supplier[]>;
  createSupplier(input: NewSupplierInput): Promise<Supplier>;
  updateSupplier(input: UpdateSupplierInput): Promise<Supplier>;
  getProductRefs(): Promise<ProductRefs>;
  createItem(input: NewItemInput): Promise<InventoryItem>;
  updateItem(input: UpdateItemInput): Promise<InventoryItem>;
  receiveStock(input: ReceiveStockInput): Promise<InventoryItem>;
  adjustStock(input: AdjustStockInput): Promise<InventoryItem>;

  getSales(query?: SaleQuery): Promise<Sale[]>;
  getSale(id: ID): Promise<Sale>;
  createSale(input: NewSaleInput): Promise<Sale>;

  /* ── Sale-side warranty ───────────────────────────────────────────
     The shop/manufacturer warranty a serialized unit ships with, the
     claims against it, and shipping a defective unit back to the vendor.
     None of this is cached in `db` — every read hits the server. Lists
     are page-paginated; detail reads carry the nested claims / filer.

     Gating (mirrors the server policies): the three list/detail reads
     need `sales_warranty.view` (supplier returns strictly need
     `inventory.view`, which every role that holds `sales_warranty.view`
     also has). Filing/resolving a claim needs `sales_warranty.manage`;
     creating/closing a supplier return needs `supplier_returns.manage`. */

  getSaleWarranties(query?: WarrantyListQuery): Promise<Paged<SaleWarranty>>;
  /** Detail — includes `claims[]`. */
  getSaleWarranty(id: ID): Promise<SaleWarranty>;
  /** Every warranty a sale issued. Unpaginated; used by the POS confirmation. */
  getSaleWarrantiesForSale(saleId: ID): Promise<SaleWarranty[]>;
  /** A unit's warranty history. Unpaginated. */
  getSaleWarrantiesForUnit(unitId: ID): Promise<SaleWarranty[]>;
  /**
   * File a claim against a warranty. Never creates a job order; a
   * `repair_board` claim may pin an existing ticket for the bench.
   */
  fileWarrantyClaim(input: {
    warrantyId: ID;
    reportedDefect: string;
    handling: ClaimHandling;
    repairTicketId?: ID;
  }): Promise<SaleWarrantyClaim>;
  getWarrantyClaims(query?: ClaimListQuery): Promise<Paged<SaleWarrantyClaim>>;
  /** Detail — includes `filedBy`. */
  getWarrantyClaim(id: ID): Promise<SaleWarrantyClaim>;
  /** `409 INVALID_STATUS_TRANSITION` if the claim is already closed. */
  resolveWarrantyClaim(input: {
    claimId: ID;
    resolution: ClaimResolution;
    outcomeNotes?: string;
  }): Promise<SaleWarrantyClaim>;

  getSupplierReturns(
    query?: SupplierReturnListQuery,
  ): Promise<Paged<SupplierReturn>>;
  getSupplierReturn(id: ID): Promise<SupplierReturn>;
  /**
   * Ship a serialized unit back to its vendor. `409` if the unit is not
   * `in_stock` / `sold` / `for_repair`. Optionally born from a claim.
   */
  createSupplierReturn(input: {
    serializedUnitId: ID;
    supplierId: ID;
    reason: SupplierReturnReason;
    reasonNote?: string;
    saleWarrantyClaimId?: ID;
  }): Promise<SupplierReturn>;
  /**
   * Record what came back. `replaced` mints a fresh unit (needs an IMEI or
   * serial); `credited` takes an amount. Closing also resolves any still-open
   * linked claim. `409` if already closed.
   */
  closeSupplierReturn(input: {
    returnId: ID;
    outcome: SupplierReturnOutcome;
    outcomeNotes?: string;
    replacement?: {
      imei?: string;
      serialNumber?: string;
      condition?: HandsetCondition;
      acquisitionCost?: number;
    };
    creditAmount?: number;
  }): Promise<SupplierReturn>;

  /**
   * Ad-hoc labour for the counter. The server prices a service line from the
   * service record — there is no per-line price override — so a one-off charge
   * has to exist as a catalog row. It persists and stays in the picker after.
   * `pos.sell` is enough.
   */
  createService(input: {
    name: string;
    price: number;
    category?: string;
  }): Promise<ServiceItem>;

  /* ── Staff ────────────────────────────────────────────────────────
     Everyone the caller may see. Branch-scoped like every other read, so
     an owner listing staff across the business reads it under the
     all-branches scope; a cashier gets a 403 and the screen says so. */
  getUsers(): Promise<User[]>;
  /** Active technicians for the assignment pickers — the whole bench across
      branches (a job order at any branch may be assigned to any of them),
      falling back to the caller's own branch when the server refuses the
      cross-branch read. */
  getTechnicians(): Promise<User[]>;
  createUser(input: NewUserInput): Promise<User>;
  updateUser(id: ID, patch: UserPatch): Promise<User>;
  /** Soft-deletes on the server: the row survives, but stops signing in. */
  deleteUser(id: ID): Promise<void>;
  /**
   * Update the signed-in user's own record via `PATCH /users/{ulid}`. Any of
   * `name`, `email`, `password` (min 8). The API has no dedicated
   * change-password route and asks for no current password — it trusts the
   * bearer token. Returns the refreshed `User`; the store re-persists the
   * session from it so the header and the "signed in as" row update without a
   * reload. `email` is the sign-in identity ("username").
   */
  updateProfile(input: {
    name?: string;
    email?: string;
    password?: string;
  }): Promise<User>;
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
  /** Scan-and-match the unit before it leaves — chain-of-custody
   *  documentation, *not* a release gate: the server dropped the IMEI half of
   *  its release guard because it stranded units whose stored IMEI never
   *  passed Luhn. `scannedImei` must still be a valid 15-digit IMEI; the
   *  endpoint rejects anything else. Release with no scan at all instead. */
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

  /* ── Device reference data ──────────────────────────────────────────
     The brand/model rows behind the intake pickers, managed under
     Settings → Devices. `getDeviceCatalog` above is the read-optimised,
     active-only view; these return the whole set, inactive included, and
     need `settings.manage` server-side. */
  getDeviceBrands(): Promise<DeviceBrand[]>;
  createDeviceBrand(input: { name: string }): Promise<DeviceBrand>;
  updateDeviceBrand(input: {
    id: ID;
    name?: string;
    active?: boolean;
  }): Promise<DeviceBrand>;
  /** The server refuses (`409`/`422`) while a model or ticket still
   *  points at it; deactivate instead when that happens. */
  deleteDeviceBrand(id: ID): Promise<void>;

  getDeviceModels(): Promise<DeviceModel[]>;
  createDeviceModel(input: {
    brandId: ID;
    name: string;
    releaseYear?: number;
  }): Promise<DeviceModel>;
  updateDeviceModel(input: {
    id: ID;
    name?: string;
    brandId?: ID;
    releaseYear?: number | null;
    active?: boolean;
  }): Promise<DeviceModel>;
  deleteDeviceModel(id: ID): Promise<void>;

  getDashboard(): Promise<DashboardSummary>;

  /* ── Branch profile ──────────────────────────────────────────────
     The caller's own branch row: name, address, contact, TIN, VAT
     registration, and receipt header/footer. These are real columns on
     `branches`, edited here rather than through key/value settings.
     Requires `settings.manage`. */
  getBranch(): Promise<BranchProfile>;
  updateBranch(patch: BranchPatch): Promise<BranchProfile>;

  /* ── The branches this account may work in ────────────────────────
     Everything the token can see. A cashier is scoped server-side to their
     own branch and gets a one-row list (or a 403, which the switcher renders
     as "no switching" rather than an error), so the UI never has to trust
     `branch.switch` alone.

     Active-only by default, which is what the switcher wants: you cannot
     work out of a closed site. Branch management passes
     `includeInactive` so a closed branch can be seen and reopened. */
  getBranches(options?: { includeInactive?: boolean }): Promise<BranchSummary[]>;
  createBranch(input: NewBranchInput): Promise<BranchSummary>;
  /* Edits any branch by id — `updateBranch` above only ever touches the
     caller's own. Branches are never deleted (the API answers 405): a site
     that closes is deactivated, so its past tickets and sales keep resolving. */
  updateBranchById(id: ID, patch: BranchRecordPatch): Promise<BranchSummary>;

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
/** What `POST /branches` requires; the rest of the record is filled in after. */
export interface NewBranchInput {
  name: string;
  /** Short code shown on ticket numbers (`JO-AL-…`); unique across the shop. */
  code: string;
  kind: BranchKind;
}

/** A partial update to any branch row. Only the keys present are sent. */
export interface BranchRecordPatch {
  name?: string;
  code?: string;
  kind?: BranchKind;
  active?: boolean;
}

/** What `POST /users` requires; every field is mandatory server-side. */
export interface NewUserInput {
  name: string;
  email: string;
  /** At least 8 characters, enforced by the API. */
  password: string;
  role: Role;
  employeeCode: string;
  branchId: ID;
}

/**
 * A partial update. Only the keys present are sent, so an untouched field is
 * never cleared; omit `password` to leave the existing one alone.
 */
export interface UserPatch {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  employeeCode?: string;
  branchId?: ID;
  active?: boolean;
}

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
