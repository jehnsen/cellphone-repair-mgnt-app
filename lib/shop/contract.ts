import type {
  ConditionCheck,
  Customer,
  DeviceInfo,
  Discount,
  HandsetCondition,
  HandsetUnitStatus,
  ID,
  InventoryItem,
  MovementReason,
  Payment,
  PaymentMethod,
  ProblemTag,
  Sale,
  SaleLineKind,
  Shift,
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
  markReadyForPickup(input: { ticketIds: ID[]; actorId: ID }): Promise<Ticket[]>;
  releaseTicket(input: {
    ticketId: ID;
    releasedTo: string;
    payment?: { amount: number; method: Payment["method"]; reference?: string };
    actorId: ID;
  }): Promise<Ticket>;

  /** Brand and model lists for the intake pickers, from the API catalog. */
  getDeviceCatalog(): Promise<DeviceCatalog>;

  getDashboard(): Promise<DashboardSummary>;
}

/** Brand and model reference lists, for the intake form's pickers. */
export interface DeviceCatalog {
  brands: string[];
  models: { brand: string; model: string }[];
}
