import type {
  AppNotification,
  Customer,
  Database,
  InventoryItem,
  Sale,
  SaleReturn,
  ServiceItem,
  Shift,
  ShopProfile,
  StockMovement,
  Supplier,
  Ticket,
  TimelineEvent,
  User,
} from "@/lib/types";

/**
 * One reducer over the whole mock database. The API layer works out *what*
 * changed; this only decides where it lands. Keeping it this thin means a
 * real backend can drive the same actions from a websocket or a refetch.
 */

export type ShopAction =
  | { type: "hydrate"; db: Database }
  | { type: "upsertTicket"; ticket: Ticket }
  | { type: "appendEvents"; events: TimelineEvent[] }
  | { type: "upsertCustomer"; customer: Customer }
  | { type: "upsertItem"; item: InventoryItem }
  | { type: "appendMovements"; movements: StockMovement[] }
  | { type: "upsertSale"; sale: Sale }
  | { type: "upsertReturn"; saleReturn: SaleReturn }
  | { type: "upsertShift"; shift: Shift }
  | { type: "upsertNotification"; notification: AppNotification }
  | { type: "upsertUser"; user: User }
  | { type: "upsertSupplier"; supplier: Supplier }
  | { type: "upsertService"; service: ServiceItem }
  | { type: "patchShop"; patch: Partial<ShopProfile> };

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((entry) => entry.id === row.id);
  if (index === -1) return [row, ...rows];
  const next = rows.slice();
  next[index] = row;
  return next;
}

export function shopReducer(state: Database, action: ShopAction): Database {
  switch (action.type) {
    case "hydrate":
      return action.db;
    case "upsertTicket":
      return { ...state, tickets: upsert(state.tickets, action.ticket) };
    case "appendEvents":
      return {
        ...state,
        timeline: [...action.events, ...state.timeline].sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        ),
      };
    case "upsertCustomer":
      return { ...state, customers: upsert(state.customers, action.customer) };
    case "upsertItem":
      return { ...state, items: upsert(state.items, action.item) };
    case "appendMovements":
      return {
        ...state,
        movements: [...action.movements, ...state.movements].sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        ),
      };
    case "upsertSale":
      return { ...state, sales: upsert(state.sales, action.sale) };
    case "upsertReturn":
      return { ...state, returns: upsert(state.returns, action.saleReturn) };
    case "upsertShift":
      return { ...state, shifts: upsert(state.shifts, action.shift) };
    case "upsertNotification":
      return {
        ...state,
        notifications: upsert(state.notifications, action.notification),
      };
    case "upsertUser":
      return { ...state, users: upsert(state.users, action.user) };
    case "upsertSupplier":
      return { ...state, suppliers: upsert(state.suppliers, action.supplier) };
    case "upsertService":
      return { ...state, services: upsert(state.services, action.service) };
    case "patchShop":
      return { ...state, shop: { ...state.shop, ...action.patch } };
    default:
      return state;
  }
}

export const EMPTY_DB: Database = {
  users: [],
  customers: [],
  tickets: [],
  timeline: [],
  items: [],
  movements: [],
  suppliers: [],
  sales: [],
  returns: [],
  shifts: [],
  services: [],
  warrantyTemplates: [],
  notificationTemplates: [],
  notifications: [],
  shop: {
    name: "",
    addressLine: "",
    city: "",
    mobile: "",
    vatRegistered: true,
    vatRate: 0.12,
    showBirDetails: false,
    receiptFooter: "",
    unclaimedAfterDays: 30,
  },
};
