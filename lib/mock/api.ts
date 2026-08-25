import { manilaDayKey, money } from "@/lib/format";
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
  ID,
  InventoryItem,
  Payment,
  ProblemTag,
  Sale,
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

  getItems(query?: ItemQuery): Promise<InventoryItem[]>;
  getItem(id: ID): Promise<InventoryItem>;
  getMovements(itemId?: ID): Promise<StockMovement[]>;
  getSuppliers(): Promise<Supplier[]>;

  getSales(query?: SaleQuery): Promise<Sale[]>;
  getSale(id: ID): Promise<Sale>;

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
