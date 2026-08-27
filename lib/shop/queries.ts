import type { Database, ID, ItemClass, TicketStatus } from "@/lib/types";

/**
 * The shapes screens use to ask for a filtered list, and the two stock
 * questions they ask of whatever is in hand.
 *
 * Filters the API allow-lists are pushed down to the server; the rest are
 * applied client-side (see `fetchTickets` in lib/api/live-api.ts for which,
 * and why).
 */

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

/**
 * Stock on hand. Serialized handsets are counted as units; everything else
 * carries a quantity.
 *
 * The API has no stock-level endpoint yet, so live products report 0 until
 * that ships — which is why the inventory screen says so rather than drawing
 * a number nobody can trust.
 */
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
