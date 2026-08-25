import type {
  Database,
  ID,
  ItemClass,
  Role,
  Ticket,
  TicketStatus,
} from "@/lib/types";
import { agingOf } from "@/lib/status";

/**
 * The seam between the app and "the server".
 *
 * Everything below pretends to be a network: it takes time, it can fail, and
 * it hands back plain data. Swap `createMockApi` for a fetch client and the
 * screens do not change.
 */

export const LATENCY = { min: 120, max: 420 };

/** Flipped from the shell so error states can be demonstrated on demand. */
export const failure = { rate: 0 };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function wait(scale = 1): Promise<void> {
  const ms = (LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min)) * scale;
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (failure.rate > 0 && Math.random() < failure.rate) {
    throw new ApiError(
      "The shop server did not respond.",
      "Check the connection and try again. Nothing was saved.",
    );
  }
}

/* ── Query shapes ────────────────────────────────────────────────────── */

export interface TicketQuery {
  status?: TicketStatus[];
  technicianId?: ID;
  brand?: string;
  overdueOnly?: boolean;
  /** ISO day bounds against createdAt. */
  from?: string;
  to?: string;
  /** Ticket no., claim code, IMEI, customer name, or mobile number. */
  search?: string;
  includeReleased?: boolean;
}

export interface ItemQuery {
  itemClass?: ItemClass;
  search?: string;
  lowStockOnly?: boolean;
  /** No movement in N days. */
  deadStockDays?: number;
  supplierId?: ID;
}

export interface SaleQuery {
  from?: string;
  to?: string;
  cashierId?: ID;
  search?: string;
}

export interface CustomerQuery {
  search?: string;
}

export interface Session {
  userId: ID;
  role: Role;
}

/* ── Shared matchers, used by the API and by report builders ─────────── */

export function ticketMatches(
  ticket: Ticket,
  db: Database,
  query: TicketQuery,
  now = new Date(),
): boolean {
  if (query.status?.length && !query.status.includes(ticket.status)) return false;
  if (query.technicianId && ticket.technicianId !== query.technicianId) return false;
  if (query.brand && ticket.device.brand !== query.brand) return false;
  if (query.includeReleased === false && ticket.status === "released") return false;
  if (query.overdueOnly && agingOf(ticket, now).tier !== "overdue") return false;
  if (query.from && new Date(ticket.createdAt) < new Date(query.from)) return false;
  if (query.to && new Date(ticket.createdAt) > new Date(query.to)) return false;

  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    if (!needle) return true;
    const customer = db.customers.find((entry) => entry.id === ticket.customerId);
    const haystack = [
      ticket.ticketNo,
      ticket.claimCode,
      ticket.device.imei,
      ticket.device.brand,
      ticket.device.model,
      customer?.name ?? "",
      customer?.mobile ?? "",
      ticket.reportedProblem,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export function itemStock(db: Database, itemId: ID): number {
  const item = db.items.find((entry) => entry.id === itemId);
  if (!item) return 0;
  if (item.itemClass === "handset") {
    return (item.units ?? []).filter((unit) => unit.status === "in_stock").length;
  }
  return item.quantityOnHand;
}

export function isLowStock(db: Database, itemId: ID): boolean {
  const item = db.items.find((entry) => entry.id === itemId);
  if (!item) return false;
  return itemStock(db, itemId) <= item.reorderPoint;
}
