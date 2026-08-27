import {
  toCustomer,
  toInventoryItem,
  toServiceItem,
  toShopProfile,
  toTicket,
  toUser,
} from "@/lib/api/mappers";
import { createLiveApi, dashboardFromTickets, type LiveContext } from "@/lib/api/live-api";
import { createUnavailableApi } from "@/lib/api/unavailable";
import type { HttpClient } from "@/lib/api/http";
import type {
  BranchDto,
  CustomerDto,
  ProductDto,
  RepairTicketDto,
  ServiceDto,
  UserDto,
} from "@/lib/api/dto";
import type { ShopApi } from "@/lib/shop/contract";
import { EMPTY_DB, type ShopAction } from "@/lib/shop/reducer";
import type {
  Customer,
  Database,
  InventoryItem,
  ServiceItem,
  Ticket,
  User,
} from "@/lib/types";

/**
 * Assembles the one API the app uses: the live client over everything the
 * server implements, and honest empties over everything it does not.
 *
 * No seeded rows anywhere. If a number is on screen, it came out of MySQL.
 */

/** Methods that change server state: these bump the query version on success. */
const MUTATIONS = new Set<keyof ShopApi>([
  "createTicket",
  "setTicketStatus",
  "assignTechnician",
  "markReadyForPickup",
  "releaseTicket",
  "addNote",
  "createCustomer",
  "updateCustomer",
  "createSale",
  "receiveStock",
  "adjustStock",
  "openShift",
  "closeShift",
  "addCashMovement",
]);

export interface ShopApiDeps {
  client: HttpClient;
  context: LiveContext;
  getDb: () => Database;
  /** Bumps the query version — every screen refetches. */
  dispatch: (action: ShopAction) => void;
  /** Updates the local cache without triggering a refetch loop. */
  dispatchQuiet: (action: ShopAction) => void;
}

export function createShopApi({
  client,
  context,
  getDb,
  dispatch,
  dispatchQuiet,
}: ShopApiDeps): ShopApi {
  const api: ShopApi = { ...createUnavailableApi(), ...createLiveApi(client, context) };

  /* The day sheet's counts.
     This deliberately re-reads the tickets rather than counting the local
     cache: the overdue and ready badges are the numbers this shop is run on,
     and a count that lags an action would be worse than a slow one. The cost
     is paid once — the request is identical to the board's, so the HTTP layer
     collapses them into a single walk. */
  const unavailableDashboard = api.getDashboard;
  api.getDashboard = async () => {
    const base = await unavailableDashboard();
    const tickets = await api.getTickets({});
    return dashboardFromTickets(tickets, base);
  };

  return wrap(api, { getDb, dispatch, dispatchQuiet });
}

/**
 * Two side effects around every call:
 *   reads  — feed the local cache so `db.customers` / `db.tickets` lookups in
 *            the screens resolve against live rows (quietly: no refetch).
 *   writes — bump the version so every open list refetches from the server.
 */
function wrap(
  api: ShopApi,
  deps: Pick<ShopApiDeps, "getDb" | "dispatch" | "dispatchQuiet">,
): ShopApi {
  const wrapped = {} as Record<string, unknown>;

  for (const [name, value] of Object.entries(api)) {
    if (typeof value !== "function") {
      wrapped[name] = value;
      continue;
    }

    const method = name as keyof ShopApi;
    wrapped[name] = async (...args: unknown[]) => {
      const result = await (value as (...a: unknown[]) => Promise<unknown>)(...args);

      if (method === "getTickets" && Array.isArray(result)) {
        cache(deps, "setTickets", "tickets", result as Ticket[]);
      }
      if (method === "getCustomers" && Array.isArray(result)) {
        cache(deps, "setCustomers", "customers", result as Customer[]);
      }
      if (method === "getItems" && Array.isArray(result)) {
        cache(deps, "setItems", "items", result as InventoryItem[]);
      }
      if (method === "getUsers" && Array.isArray(result)) {
        const users = result as User[];
        if (users.length && !sameIds(deps.getDb().users, users)) {
          deps.dispatchQuiet({ type: "setUsers", users });
        }
      }
      if (method === "getTicket" && result) {
        deps.dispatchQuiet({ type: "upsertTicket", ticket: result as Ticket });
      }
      if (MUTATIONS.has(method)) {
        deps.dispatch({ type: "touch" });
      }

      return result;
    };
  }

  return wrapped as unknown as ShopApi;
}

/* Only replace the cache when it actually changed, so a background refetch
   never re-renders the whole app for nothing. */
function cache<T extends { id: string }>(
  deps: Pick<ShopApiDeps, "getDb" | "dispatchQuiet">,
  action: "setTickets" | "setCustomers" | "setItems",
  key: "tickets" | "customers" | "items",
  incoming: T[],
) {
  const merged = mergeById(deps.getDb()[key] as unknown as T[], incoming);
  if (merged) {
    deps.dispatchQuiet({ type: action, [key]: merged } as unknown as ShopAction);
  }
}

/** Returns the merged list, or null when nothing changed. */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] | null {
  if (!incoming.length) return null;

  const byId = new Map(current.map((row) => [row.id, row]));
  let changed = false;

  for (const row of incoming) {
    const existing = byId.get(row.id);
    if (!existing || JSON.stringify(existing) !== JSON.stringify(row)) {
      byId.set(row.id, row);
      changed = true;
    }
  }

  return changed ? [...byId.values()] : null;
}

function sameIds<T extends { id: string }>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((row, index) => row.id === b[index]?.id);
}

/* ── Bootstrap ───────────────────────────────────────────────────────── */

export interface BootstrapResult {
  db: Database;
  /** Contexts this account could not read, named so the user is not guessing. */
  warnings: string[];
}

/**
 * First load: fetch every context the API owns. What it does not own stays
 * empty, and the screens for those show their empty states.
 */
export async function bootstrapShop(
  client: HttpClient,
  branch: BranchDto | null,
  self: User | null,
): Promise<BootstrapResult> {
  const warnings: string[] = [];

  const failed = <T,>(label: string, fallback: T) => (caught: Error) => {
    warnings.push(`${label} could not be loaded: ${caught.message}`);
    return fallback;
  };

  const [customers, users, tickets, items, services] = await Promise.all([
    client
      .getAll<CustomerDto>("/customers")
      .then((rows) => rows.map(toCustomer))
      .catch(failed("Customers", [] as Customer[])),
    client
      .getAll<UserDto>("/users")
      .then((rows) => rows.map(toUser))
      /* Cashiers and technicians cannot list staff — expected, not a warning. */
      .catch(() => [] as User[]),
    client
      .getAll<RepairTicketDto>("/tickets", { query: { sort: "-created_at" } })
      .then((rows) => rows.map((dto) => toTicket(dto)))
      .catch(failed("Repair tickets", [] as Ticket[])),
    client
      .getAll<ProductDto>("/products", { query: { include: "compatibleDeviceModels" } })
      .then((rows) => rows.map(toInventoryItem))
      .catch(failed("The product catalog", [] as InventoryItem[])),
    client
      .getAll<ServiceDto>("/services")
      .then((rows) => rows.map(toServiceItem))
      .catch(failed("The service list", [] as ServiceItem[])),
  ]);

  return {
    db: {
      ...EMPTY_DB,
      customers,
      users: users.length ? users : self ? [self] : [],
      tickets,
      items,
      services,
      /* Timelines are fetched per ticket, so nothing is preloaded here. */
      timeline: [],
      shop: branch ? toShopProfile(branch, EMPTY_DB.shop) : EMPTY_DB.shop,
    },
    warnings,
  };
}
