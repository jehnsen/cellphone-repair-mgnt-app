import { manilaDayKey, money } from "@/lib/format";
import { computeTax } from "@/lib/vat";
import { agingOf, STATUS_META } from "@/lib/status";
import { nextSequence } from "@/lib/mock/seed";
import {
  ApiError,
  isLowStock,
  itemStock,
  ticketMatches,
  wait,
  type CustomerQuery,
  type ItemQuery,
  type SaleQuery,
  type TicketQuery,
} from "@/lib/mock/db";
import type { ShopAction } from "@/lib/mock/reducer";
import type {
  AppNotification,
  Customer,
  Database,
  DeviceInfo,
  Discount,
  HandsetCondition,
  HandsetUnit,
  HandsetUnitStatus,
  ID,
  MovementReason,
  InventoryItem,
  Payment,
  PaymentMethod,
  ProblemTag,
  Sale,
  SaleLine,
  SaleLineKind,
  SalePayment,
  Shift,
  StockMovement,
  Supplier,
  Ticket,
  TicketPhoto,
  TicketStatus,
  TimelineEvent,
  ConditionCheck,
  TurnedOverAccessory,
  User,
} from "@/lib/types";

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

  getDashboard(): Promise<DashboardSummary>;
}

/* ── Implementation ──────────────────────────────────────────────────── */

let sequence = 0;
const nextId = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
};

const claimCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

export function createMockApi(
  getDb: () => Database,
  dispatch: (action: ShopAction) => void,
): ShopApi {
  const requireTicket = (id: ID): Ticket => {
    const ticket = getDb().tickets.find((entry) => entry.id === id);
    if (!ticket) {
      throw new ApiError(
        `Ticket ${id} was not found.`,
        "It may have been released or removed. Search the board by ticket number.",
      );
    }
    return ticket;
  };

  const event = (
    ticketId: ID,
    type: TimelineEvent["type"],
    message: string,
    actorId: ID,
    meta?: TimelineEvent["meta"],
  ): TimelineEvent => ({
    id: nextId("evt"),
    ticketId,
    type,
    message,
    actorId,
    at: new Date().toISOString(),
    meta,
  });

  return {
    async getTickets(query = {}) {
      await wait();
      const db = getDb();
      const now = new Date();
      return db.tickets
        .filter((ticket) => ticketMatches(ticket, db, query, now))
        .sort(
          (a, b) =>
            new Date(a.promisedAt).getTime() - new Date(b.promisedAt).getTime(),
        );
    },

    async getTicket(id) {
      await wait(0.6);
      return requireTicket(id);
    },

    async findTicketByCode(code) {
      await wait(0.5);
      const needle = code.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
      const db = getDb();
      return (
        db.tickets.find(
          (ticket) =>
            ticket.claimCode.toUpperCase() === needle.replace(/-/g, "") ||
            ticket.ticketNo.toUpperCase() === needle ||
            ticket.device.imei === needle,
        ) ?? null
      );
    },

    async getTimeline(ticketId) {
      await wait(0.5);
      return getDb()
        .timeline.filter((entry) => entry.ticketId === ticketId)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },

    async getCustomers(query = {}) {
      await wait();
      const needle = query.search?.trim().toLowerCase();
      const rows = getDb().customers;
      if (!needle) return [...rows].sort((a, b) => a.name.localeCompare(b.name));
      return rows
        .filter((customer) =>
          `${customer.name} ${customer.mobile} ${customer.email ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getCustomer(id) {
      await wait(0.5);
      const customer = getDb().customers.find((entry) => entry.id === id);
      if (!customer) {
        throw new ApiError(
          "That customer record was not found.",
          "Try searching by mobile number instead.",
        );
      }
      return customer;
    },

    async createCustomer(input) {
      await wait(0.7);
      const customer: Customer = {
        ...input,
        id: nextId("cus"),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "upsertCustomer", customer });
      return customer;
    },

    async updateCustomer({ id, ...patch }) {
      await wait(0.6);
      const current = getDb().customers.find((entry) => entry.id === id);
      if (!current) {
        throw new ApiError(
          "That customer record was not found.",
          "It may have been merged. Search by mobile number.",
        );
      }
      if (patch.name != null && !patch.name.trim()) {
        throw new ApiError("A customer needs a name.", "Enter the name on the ID or receipt.");
      }
      const customer: Customer = { ...current, ...patch };
      dispatch({ type: "upsertCustomer", customer });
      return customer;
    },

    async getItems(query = {}) {
      await wait();
      const db = getDb();
      const now = Date.now();
      return db.items
        .filter((item) => {
          if (query.itemClass && item.itemClass !== query.itemClass) return false;
          if (query.supplierId && item.supplierId !== query.supplierId) return false;
          if (query.lowStockOnly && !isLowStock(db, item.id)) return false;
          if (query.deadStockDays) {
            const last = item.lastMovementAt ? new Date(item.lastMovementAt).getTime() : 0;
            if (now - last < query.deadStockDays * 86_400_000) return false;
          }
          if (query.search) {
            const needle = query.search.toLowerCase();
            const haystack = [
              item.name,
              item.sku,
              item.brand,
              item.barcode ?? "",
              ...(item.compatibleModels ?? []),
              ...(item.units ?? []).map((unit) => unit.imei),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(needle)) return false;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getItem(id) {
      await wait(0.5);
      const item = getDb().items.find((entry) => entry.id === id);
      if (!item) {
        throw new ApiError("That item was not found.", "It may have been deactivated.");
      }
      return item;
    },

    async getMovements(itemId) {
      await wait(0.6);
      const rows = getDb().movements;
      return itemId ? rows.filter((movement) => movement.itemId === itemId) : rows;
    },

    async getSuppliers() {
      await wait(0.5);
      return [...getDb().suppliers].sort((a, b) => a.name.localeCompare(b.name));
    },

    async receiveStock(input) {
      await wait(0.8);
      const db = getDb();
      const item = db.items.find((entry) => entry.id === input.itemId);
      if (!item) {
        throw new ApiError("That item was not found.", "It may have been deactivated.");
      }

      const now = new Date();
      const movements: StockMovement[] = [];
      let next: InventoryItem;

      if (item.itemClass === "handset") {
        const rows = input.units ?? [];
        if (!rows.length) {
          throw new ApiError(
            "No units to receive.",
            "Handsets are tracked one by one — add at least one IMEI.",
          );
        }
        const existing = new Set((item.units ?? []).map((unit) => unit.imei));
        rows.forEach((row) => {
          if (existing.has(row.imei)) {
            throw new ApiError(
              `IMEI ${row.imei} is already in stock.`,
              "Every handset unit needs its own IMEI.",
            );
          }
          existing.add(row.imei);
        });

        const units: HandsetUnit[] = rows.map((row) => ({
          id: nextId("unit"),
          itemId: item.id,
          imei: row.imei,
          condition: row.condition,
          status: "in_stock",
          cost: money(row.cost),
          price: money(row.price),
          storage: row.storage,
          color: row.color,
          warrantyDays: row.warrantyDays,
          supplierId: input.supplierId ?? item.supplierId,
          receivedAt: now.toISOString(),
        }));

        units.forEach((unit) => {
          movements.push({
            id: nextId("mv"),
            itemId: item.id,
            unitId: unit.id,
            quantity: 1,
            reason: "receiving",
            reference: input.reference,
            unitCost: unit.cost,
            note: input.note,
            at: now.toISOString(),
            by: input.userId,
          });
        });

        next = {
          ...item,
          units: [...(item.units ?? []), ...units],
          supplierId: input.supplierId ?? item.supplierId,
          lastMovementAt: now.toISOString(),
        };
      } else {
        const quantity = input.quantity ?? 0;
        if (quantity <= 0) {
          throw new ApiError("Nothing to receive.", "Enter a quantity greater than zero.");
        }
        movements.push({
          id: nextId("mv"),
          itemId: item.id,
          quantity,
          reason: "receiving",
          reference: input.reference,
          unitCost: input.unitCost ?? item.unitCost,
          note: input.note,
          at: now.toISOString(),
          by: input.userId,
        });
        next = {
          ...item,
          quantityOnHand: item.quantityOnHand + quantity,
          unitCost: input.unitCost != null ? money(input.unitCost) : item.unitCost,
          supplierId: input.supplierId ?? item.supplierId,
          lastMovementAt: now.toISOString(),
        };
      }

      dispatch({ type: "upsertItem", item: next });
      dispatch({ type: "appendMovements", movements });
      return next;
    },

    async adjustStock(input) {
      await wait(0.7);
      const db = getDb();
      const item = db.items.find((entry) => entry.id === input.itemId);
      if (!item) {
        throw new ApiError("That item was not found.", "It may have been deactivated.");
      }
      if (!input.note?.trim()) {
        throw new ApiError(
          "An adjustment needs a reason in writing.",
          "Say what happened — a count correction without a note cannot be audited.",
        );
      }

      const now = new Date();
      let next: InventoryItem;
      let quantity: number;
      let unitId: ID | undefined;

      if (item.itemClass === "handset") {
        const unit = (item.units ?? []).find((entry) => entry.id === input.unitId);
        if (!unit) {
          throw new ApiError("Pick a unit to adjust.", "Handsets are adjusted one IMEI at a time.");
        }
        const status = input.unitStatus ?? "returned";
        next = {
          ...item,
          units: (item.units ?? []).map((entry) =>
            entry.id === unit.id ? { ...entry, status } : entry,
          ),
          lastMovementAt: now.toISOString(),
        };
        quantity = status === "in_stock" ? 1 : -1;
        unitId = unit.id;
      } else {
        quantity = input.quantity ?? 0;
        if (quantity === 0) {
          throw new ApiError("Nothing to adjust.", "Enter a non-zero quantity.");
        }
        const onHand = item.quantityOnHand + quantity;
        if (onHand < 0) {
          throw new ApiError(
            `Only ${item.quantityOnHand} on hand.`,
            "An adjustment cannot take stock below zero.",
          );
        }
        next = {
          ...item,
          quantityOnHand: onHand,
          lastMovementAt: now.toISOString(),
        };
      }

      dispatch({ type: "upsertItem", item: next });
      dispatch({
        type: "appendMovements",
        movements: [
          {
            id: nextId("mv"),
            itemId: item.id,
            unitId,
            quantity,
            reason: input.reason,
            note: input.note.trim(),
            at: now.toISOString(),
            by: input.userId,
          },
        ],
      });
      return next;
    },

    async getSales(query = {}) {
      await wait();
      return getDb()
        .sales.filter((sale) => {
          if (query.from && new Date(sale.soldAt) < new Date(query.from)) return false;
          if (query.to && new Date(sale.soldAt) > new Date(query.to)) return false;
          if (query.cashierId && sale.cashierId !== query.cashierId) return false;
          if (query.search) {
            const needle = query.search.toLowerCase();
            const haystack = [sale.saleNo, sale.officialReceiptNo ?? "", ...sale.lines.map((l) => l.name)]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(needle)) return false;
          }
          return true;
        })
        .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
    },

    async getSale(id) {
      await wait(0.5);
      const sale = getDb().sales.find((entry) => entry.id === id);
      if (!sale) {
        throw new ApiError("That sale was not found.", "Search by sale number in Reports.");
      }
      return sale;
    },

    async createSale(input) {
      await wait(0.9);
      const db = getDb();
      const now = new Date();

      if (!input.lines.length) {
        throw new ApiError("The cart is empty.", "Scan or add an item before charging.");
      }

      const shift = db.shifts.find((entry) => entry.status === "open");
      if (!shift) {
        throw new ApiError(
          "No shift is open.",
          "Open the cash drawer for today before ringing up a sale.",
        );
      }

      /* Stock check first: nothing is written until the whole cart clears. */
      input.lines.forEach((line) => {
        if (!line.itemId) return;
        const item = db.items.find((entry) => entry.id === line.itemId);
        if (!item) {
          throw new ApiError(`${line.name} is no longer in the catalog.`, "Remove it and try again.");
        }
        if (line.kind === "handset") {
          const unit = item.units?.find((entry) => entry.id === line.unitId);
          if (!unit || unit.status !== "in_stock") {
            throw new ApiError(
              `${line.name} is no longer available.`,
              "That handset was sold or reserved. Pick another unit.",
            );
          }
        } else if (itemStock(db, item.id) < line.quantity) {
          throw new ApiError(
            `Only ${itemStock(db, item.id)} left of ${item.name}.`,
            "Lower the quantity or receive more stock first.",
          );
        }
      });

      const id = nextId("sal");
      const lines: SaleLine[] = input.lines.map((line, index) => ({
        id: `${id}-ln-${index + 1}`,
        kind: line.kind,
        itemId: line.itemId,
        unitId: line.unitId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: money(line.unitPrice),
        unitCost: money(line.unitCost),
        discount: line.discount,
        lineTotal: money(
          line.unitPrice * line.quantity -
            (line.discount
              ? line.discount.kind === "percent"
                ? line.unitPrice * line.quantity * (line.discount.value / 100)
                : line.discount.value
              : 0),
        ),
      }));

      const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));
      const tax = computeTax({
        subtotal,
        orderDiscount: input.orderDiscount,
        seniorPwd: { applies: Boolean(input.seniorPwd) },
        vatRegistered: db.shop.vatRegistered,
        vatRate: db.shop.vatRate,
      });

      const paid = money(input.payments.reduce((sum, payment) => sum + payment.amount, 0));
      if (paid + 0.01 < tax.totalDue) {
        throw new ApiError(
          `Short by ₱${money(tax.totalDue - paid).toLocaleString("en-PH")}.`,
          "Add a payment line to cover the balance.",
        );
      }

      const payments: SalePayment[] = input.payments.map((payment, index) => ({
        id: `${id}-pm-${index + 1}`,
        method: payment.method,
        amount: money(payment.amount),
        reference: payment.reference,
        tendered: payment.tendered != null ? money(payment.tendered) : undefined,
        change:
          payment.method === "cash" && payment.tendered != null
            ? money(Math.max(0, payment.tendered - payment.amount))
            : undefined,
      }));

      const sale: Sale = {
        id,
        saleNo: nextSequence("SI", db.sales.map((entry) => entry.saleNo), now),
        officialReceiptNo: input.officialReceiptNo,
        customerId: input.customerId,
        lines,
        subtotal,
        orderDiscount: input.orderDiscount,
        seniorPwdDiscount: input.seniorPwd
          ? {
              idNumber: input.seniorPwd.idNumber,
              type: input.seniorPwd.type,
              name: input.seniorPwd.name,
              beneficiaries: input.seniorPwd.beneficiaries,
              vatExemptSales: tax.vatExemptSales,
              discountAmount: tax.seniorPwdDiscount,
            }
          : undefined,
        vatableSales: tax.vatableSales,
        vatExemptSales: tax.vatExemptSales,
        vatAmount: tax.vatAmount,
        zeroRatedSales: tax.zeroRatedSales,
        totalDue: tax.totalDue,
        payments,
        status: "completed",
        cashierId: input.cashierId,
        shiftId: shift.id,
        soldAt: now.toISOString(),
        note: input.note,
      };

      /* Draw down stock: handsets by unit, everything else by quantity. */
      const movements: StockMovement[] = [];
      lines.forEach((line) => {
        if (!line.itemId) return;
        const item = db.items.find((entry) => entry.id === line.itemId);
        if (!item) return;

        if (line.kind === "handset" && line.unitId) {
          const units = (item.units ?? []).map((unit): HandsetUnit =>
            unit.id === line.unitId
              ? { ...unit, status: "sold", soldAt: now.toISOString(), saleId: id }
              : unit,
          );
          dispatch({
            type: "upsertItem",
            item: { ...item, units, lastMovementAt: now.toISOString() },
          });
        } else {
          dispatch({
            type: "upsertItem",
            item: {
              ...item,
              quantityOnHand: item.quantityOnHand - line.quantity,
              lastMovementAt: now.toISOString(),
            },
          });
        }

        movements.push({
          id: nextId("mv"),
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: -line.quantity,
          reason: "sale",
          reference: sale.saleNo,
          saleId: id,
          unitCost: line.unitCost,
          at: now.toISOString(),
          by: input.cashierId,
        });
      });

      dispatch({ type: "upsertSale", sale });
      if (movements.length) dispatch({ type: "appendMovements", movements });
      return sale;
    },

    async getUsers() {
      await wait(0.4);
      return getDb().users;
    },

    async getShifts() {
      await wait(0.5);
      return [...getDb().shifts].sort(
        (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
      );
    },

    async getOpenShift() {
      await wait(0.4);
      return getDb().shifts.find((shift) => shift.status === "open") ?? null;
    },

    async openShift({ startingCash, userId }) {
      await wait(0.8);
      const db = getDb();
      if (db.shifts.some((shift) => shift.status === "open")) {
        throw new ApiError(
          "A shift is already open.",
          "Close the current shift before opening a new one.",
        );
      }
      const now = new Date();
      const shift: Shift = {
        id: nextId("shf"),
        shiftNo: `SH-${manilaDayKey(now).replace(/-/g, "")}`,
        openedBy: userId,
        openedAt: now.toISOString(),
        startingCash: money(startingCash),
        movements: [],
        status: "open",
      };
      dispatch({ type: "upsertShift", shift });
      return shift;
    },

    async closeShift({ shiftId, countedCash, userId, note }) {
      await wait(0.9);
      const db = getDb();
      const shift = db.shifts.find((entry) => entry.id === shiftId);
      if (!shift) {
        throw new ApiError("That shift was not found.", "Reload the page and try again.");
      }
      const expected = expectedCash(db, shift);
      const closed: Shift = {
        ...shift,
        status: "closed",
        closedAt: new Date().toISOString(),
        closedBy: userId,
        countedCash: money(countedCash),
        expectedCash: expected,
        variance: money(countedCash - expected),
        note,
      };
      dispatch({ type: "upsertShift", shift: closed });
      return closed;
    },

    async addCashMovement({ shiftId, kind, amount, reason, userId }) {
      await wait(0.6);
      const shift = getDb().shifts.find((entry) => entry.id === shiftId);
      if (!shift) {
        throw new ApiError("That shift was not found.", "Open a shift first.");
      }
      const next: Shift = {
        ...shift,
        movements: [
          ...shift.movements,
          {
            id: nextId("csh"),
            shiftId,
            kind,
            amount: money(amount),
            reason,
            at: new Date().toISOString(),
            by: userId,
          },
        ],
      };
      dispatch({ type: "upsertShift", shift: next });
      return next;
    },

    async createTicket(input) {
      await wait(0.9);
      const db = getDb();
      const now = new Date();

      let customerId = input.customerId;
      if (!customerId && input.newCustomer) {
        const customer: Customer = {
          id: nextId("cus"),
          name: input.newCustomer.name,
          mobile: input.newCustomer.mobile,
          email: input.newCustomer.email,
          createdAt: now.toISOString(),
        };
        dispatch({ type: "upsertCustomer", customer });
        customerId = customer.id;
      }
      if (!customerId) {
        throw new ApiError(
          "This job order has no customer.",
          "Pick an existing customer or fill in the new-customer fields.",
        );
      }

      const payments: Payment[] = [];
      if (input.downpayment > 0) {
        payments.push({
          id: nextId("pay"),
          amount: money(input.downpayment),
          method: input.downpaymentMethod,
          kind: "downpayment",
          receivedAt: now.toISOString(),
          receivedBy: input.createdBy,
          shiftId: db.shifts.find((shift) => shift.status === "open")?.id,
        });
      }

      const ticket: Ticket = {
        id: nextId("tkt"),
        ticketNo: nextSequence(
          "JO",
          db.tickets.map((entry) => entry.ticketNo),
          now,
        ),
        claimCode: claimCode(),
        status: "received",
        customerId,
        device: input.device,
        reportedProblem: input.reportedProblem,
        problemTags: input.problemTags,
        turnedOver: input.turnedOver,
        conditionChecks: input.conditionChecks,
        photos: input.photos,
        estimatedCost: money(input.estimatedCost),
        laborCharge: 0,
        partsTotal: 0,
        totalDue: money(input.estimatedCost),
        amountPaid: money(input.downpayment),
        balance: money(input.estimatedCost - input.downpayment),
        promisedAt: input.promisedAt,
        warrantyDays: input.warrantyDays,
        technicianId: input.technicianId,
        partsUsed: [],
        quoteState: "none",
        payments,
        isWarrantyClaim: false,
        termsAcceptedAt: now.toISOString(),
        createdAt: now.toISOString(),
        createdBy: input.createdBy,
        updatedAt: now.toISOString(),
        statusChangedAt: now.toISOString(),
      };

      const customer = getDb().customers.find((entry) => entry.id === customerId);
      const events: TimelineEvent[] = [
        event(
          ticket.id,
          "created",
          `Received ${ticket.device.brand} ${ticket.device.model} from ${customer?.name ?? "walk-in"}.`,
          input.createdBy,
        ),
      ];
      if (input.technicianId) {
        const tech = db.users.find((user) => user.id === input.technicianId);
        events.push(
          event(ticket.id, "assigned", `Assigned to ${tech?.name ?? "technician"}.`, input.createdBy),
        );
      }
      if (payments.length) {
        events.push(
          event(
            ticket.id,
            "payment",
            `Downpayment of ₱${money(input.downpayment).toLocaleString("en-PH")} received (${input.downpaymentMethod}).`,
            input.createdBy,
            { amount: money(input.downpayment) },
          ),
        );
      }

      dispatch({ type: "upsertTicket", ticket });
      dispatch({ type: "appendEvents", events });
      return ticket;
    },

    async setTicketStatus({ ticketId, status, actorId, note }) {
      await wait(0.7);
      const current = requireTicket(ticketId);
      if (current.status === "released") {
        throw new ApiError(
          "This ticket is already released.",
          "Released tickets are locked. File a warranty claim to open a new job.",
        );
      }
      const now = new Date().toISOString();
      const ticket: Ticket = {
        ...current,
        status,
        statusChangedAt: now,
        updatedAt: now,
      };
      const events = [
        event(
          ticketId,
          "status_changed",
          `Moved to ${STATUS_META[status].label.toLowerCase()}.`,
          actorId,
          { from: current.status, to: status },
        ),
      ];
      if (note?.trim()) events.push(event(ticketId, "note", note.trim(), actorId));
      dispatch({ type: "upsertTicket", ticket });
      dispatch({ type: "appendEvents", events });
      return ticket;
    },

    async assignTechnician({ ticketIds, technicianId, actorId }) {
      await wait(0.8);
      const db = getDb();
      const tech = db.users.find((user) => user.id === technicianId);
      if (!tech) {
        throw new ApiError("That technician is not on the roster.", "Pick another technician.");
      }
      const updated: Ticket[] = [];
      const events: TimelineEvent[] = [];
      ticketIds.forEach((id) => {
        const current = db.tickets.find((entry) => entry.id === id);
        if (!current) return;
        const ticket: Ticket = {
          ...current,
          technicianId,
          updatedAt: new Date().toISOString(),
        };
        updated.push(ticket);
        events.push(event(id, "assigned", `Reassigned to ${tech.name}.`, actorId));
        dispatch({ type: "upsertTicket", ticket });
      });
      dispatch({ type: "appendEvents", events });
      return updated;
    },

    async addNote({ ticketId, note, actorId }) {
      await wait(0.5);
      requireTicket(ticketId);
      const entry = event(ticketId, "note", note.trim(), actorId);
      dispatch({ type: "appendEvents", events: [entry] });
      return entry;
    },

    async markReadyForPickup({ ticketIds, actorId }) {
      await wait(0.9);
      const db = getDb();
      const template = db.notificationTemplates.find(
        (entry) => entry.key === "ready_for_pickup",
      );
      const updated: Ticket[] = [];
      const events: TimelineEvent[] = [];

      ticketIds.forEach((id) => {
        const current = db.tickets.find((entry) => entry.id === id);
        if (!current) return;
        const now = new Date().toISOString();
        const ticket: Ticket = {
          ...current,
          status: "ready_for_pickup",
          statusChangedAt: now,
          updatedAt: now,
        };
        dispatch({ type: "upsertTicket", ticket });
        updated.push(ticket);
        events.push(event(id, "status_changed", "Moved to ready for pickup.", actorId));

        const customer = db.customers.find((entry) => entry.id === current.customerId);
        if (customer && template) {
          const notification: AppNotification = {
            id: nextId("ntf"),
            ticketId: id,
            customerId: customer.id,
            channel: template.channel,
            body: renderTemplate(template.body, {
              customer: customer.name.split(" ")[0] ?? customer.name,
              ticket_no: ticket.ticketNo,
              claim_code: ticket.claimCode,
              device: `${ticket.device.brand} ${ticket.device.model}`,
              balance: `₱${ticket.balance.toLocaleString("en-PH")}`,
              shop: db.shop.name,
            }),
            state: "queued",
            queuedAt: now,
          };
          dispatch({ type: "upsertNotification", notification });
          events.push(event(id, "notified", "Pickup notice queued for sending.", actorId));
        }
      });

      dispatch({ type: "appendEvents", events });
      return updated;
    },

    async releaseTicket({ ticketId, releasedTo, payment, actorId }) {
      await wait(0.9);
      const db = getDb();
      const current = requireTicket(ticketId);
      if (current.status === "released") {
        throw new ApiError(
          "This ticket is already released.",
          "Released tickets are locked. File a warranty claim to open a new job.",
        );
      }
      if (!releasedTo.trim()) {
        throw new ApiError(
          "Who is claiming this unit?",
          "Enter the claimant's name before releasing.",
        );
      }

      const now = new Date();
      const paidNow = payment ? money(payment.amount) : 0;
      const balance = money(current.balance - paidNow);
      if (balance > 0.01) {
        throw new ApiError(
          `A balance of ₱${balance.toLocaleString("en-PH")} remains.`,
          "Collect the full balance before releasing the unit.",
        );
      }

      const payments: Payment[] = [...current.payments];
      if (paidNow > 0 && payment) {
        payments.push({
          id: nextId("pay"),
          amount: paidNow,
          method: payment.method,
          reference: payment.reference,
          kind: "balance",
          receivedAt: now.toISOString(),
          receivedBy: actorId,
          shiftId: db.shifts.find((shift) => shift.status === "open")?.id,
        });
      }

      const template =
        db.warrantyTemplates.find((entry) => entry.periodDays === current.warrantyDays) ??
        db.warrantyTemplates.find((entry) => entry.isDefault);
      const warrantyDays = current.warrantyDays;
      const warranty =
        warrantyDays > 0
          ? {
              claimCode: current.claimCode,
              scope: template?.scope ?? "The specific fault repaired on this job order.",
              periodDays: warrantyDays,
              startsAt: now.toISOString(),
              expiresAt: new Date(now.getTime() + warrantyDays * 86_400_000).toISOString(),
              exclusions: template?.exclusions ?? [],
            }
          : undefined;

      const ticket: Ticket = {
        ...current,
        status: "released",
        amountPaid: money(current.amountPaid + paidNow),
        balance: 0,
        payments,
        warranty,
        releasedAt: now.toISOString(),
        releasedBy: actorId,
        releasedTo: releasedTo.trim(),
        statusChangedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const events: TimelineEvent[] = [];
      if (paidNow > 0) {
        events.push(
          event(
            ticketId,
            "payment",
            `Balance of ₱${paidNow.toLocaleString("en-PH")} received (${payment?.method}).`,
            actorId,
            { amount: paidNow },
          ),
        );
      }
      events.push(
        event(ticketId, "released", `Released to ${ticket.releasedTo}.`, actorId),
      );

      dispatch({ type: "upsertTicket", ticket });
      dispatch({ type: "appendEvents", events });
      return ticket;
    },

    async getDashboard() {
      await wait(0.7);
      const db = getDb();
      const now = new Date();
      const todayKey = manilaDayKey(now);

      const todaySales = db.sales.filter((sale) => manilaDayKey(sale.soldAt) === todayKey);
      const openShift = db.shifts.find((shift) => shift.status === "open") ?? null;
      const open = db.tickets.filter((ticket) => !STATUS_META[ticket.status].terminal);

      const byStatus = Object.values(STATUS_META)
        .filter((meta) => meta.onBoard)
        .map((meta) => ({
          status: meta.status,
          count: db.tickets.filter((ticket) => ticket.status === meta.status).length,
        }));

      return {
        todaySales: money(todaySales.reduce((sum, sale) => sum + sale.totalDue, 0)),
        todaySaleCount: todaySales.length,
        openTickets: open.length,
        byStatus,
        overdue: open.filter((ticket) => agingOf(ticket, now).tier === "overdue").length,
        readyForPickup: db.tickets.filter((ticket) => ticket.status === "ready_for_pickup").length,
        lowStock: db.items.filter((item) => isLowStock(db, item.id)).length,
        cashOnHand: openShift ? expectedCash(db, openShift) : null,
        openShiftId: openShift?.id ?? null,
        unclaimed: db.tickets.filter((ticket) => ticket.status === "unclaimed").length,
        awaitingApproval: db.tickets.filter((ticket) => ticket.status === "awaiting_approval").length,
      };
    },
  };
}

/* ── Derived values shared by the API and the shift screens ──────────── */

export function expectedCash(db: Database, shift: Shift): number {
  const cashSales = db.sales
    .filter((sale) => sale.shiftId === shift.id)
    .flatMap((sale) => sale.payments)
    .filter((payment) => payment.method === "cash")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const cashRepairs = db.tickets
    .flatMap((ticket) => ticket.payments)
    .filter((payment) => payment.shiftId === shift.id && payment.method === "cash")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const drawer = shift.movements.reduce(
    (sum, movement) => sum + (movement.kind === "cash_in" ? movement.amount : -movement.amount),
    0,
  );

  return money(shift.startingCash + cashSales + cashRepairs + drawer);
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export { itemStock, isLowStock };
