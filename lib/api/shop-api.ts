import {
  toCustomer,
  toInventoryItem,
  toServiceItem,
  toShopProfile,
  toTicket,
  toUser,
} from "@/lib/api/mappers";
import { createLiveApi, type LiveContext } from "@/lib/api/live-api";
import { createUnavailableApi } from "@/lib/api/unavailable";
import { createCommerceApi, loadInventory } from "@/lib/api/live-commerce";
import { createWarrantyApi } from "@/lib/api/live-warranty";
import { createSettingsApi } from "@/lib/api/live-settings";
import { toSale, toShift, toSupplier } from "@/lib/api/mappers-commerce";
import type { HttpClient } from "@/lib/api/http";
import { toDashboardSummary } from "@/lib/api/mappers";
import type {
  BranchDto,
  CustomerDto,
  BoardDto,
  DashboardDto,
  ProductDto,
  RepairTicketDto,
  SaleDto,
  ServiceDto,
  ShiftDto,
  SupplierDto,
  UserDto,
} from "@/lib/api/dto";
import { money, manilaDayKey } from "@/lib/format";
import type { ShopApi } from "@/lib/shop/contract";
import { EMPTY_DB, type ShopAction } from "@/lib/shop/reducer";
import type {
  BranchProfile,
  Customer,
  Database,
  InventoryItem,
  Sale,
  ServiceItem,
  Shift,
  ShopProfile,
  Supplier,
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
  "adjustStoreCredit",
  "createDeviceBrand",
  "updateDeviceBrand",
  "deleteDeviceBrand",
  "createDeviceModel",
  "updateDeviceModel",
  "deleteDeviceModel",
  "createSale",
  "createService",
  "fileWarrantyClaim",
  "resolveWarrantyClaim",
  "createSupplierReturn",
  "closeSupplierReturn",
  "receiveStock",
  "adjustStock",
  "openShift",
  "closeShift",
  "addCashMovement",
  "updateSettings",
  "updateBranch",
  "createBranch",
  "updateBranchById",
  "createUser",
  "updateUser",
  "deleteUser",
  "createMessageTemplate",
  "updateMessageTemplate",
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
  const api: ShopApi = {
    ...createUnavailableApi(),
    ...createLiveApi(client, context),
    ...createCommerceApi(client, context),
    ...createWarrantyApi(client),
    ...createSettingsApi(client, context),
  };

  /* The day sheet's counts, computed in SQL by `GET /dashboard`.
     Never derived from `db`: that holds only what this browser has fetched and
     `getAll()` stops at 40 pages, so a cache-counted total would go quietly
     too low as the shop grows. The one thing the endpoint does not carry is
     the drawer, which is the open shift's own reconciliation. */
  api.getDashboard = async () => {
    const [{ data }, board, openShift] = await Promise.all([
      client.get<DashboardDto>("/dashboard"),
      /* `/dashboard` reports totals, not lateness or a per-status split; the
         board carries both, and its cards are the whole open set rather than
         a page of it. Optional: a failure here costs the two board-derived
         figures, not the whole day sheet. */
      client
        .get<BoardDto>("/tickets/board")
        .then(({ data: rows }) => rows)
        .catch(() => null),
      api.getOpenShift().catch(() => null),
    ]);

    const summary = toDashboardSummary(data, board);
    return {
      ...summary,
      /* `expected_cash` is the server's own reconciliation — never recomputed
         here, or the drawer would disagree with the close-out report. */
      cashOnHand: openShift?.expectedCash ?? openShift?.startingCash ?? null,
      openShiftId: openShift?.id ?? null,
    };
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
      /* Receipts and POS read `db.shop`, a lossy view of the branch row. Keep
         its overlapping fields in step whenever the branch profile is read or
         edited, so a name or VAT change shows on the next print without a
         reload. */
      if ((method === "getBranch" || method === "updateBranch") && result) {
        deps.dispatchQuiet({
          type: "patchShop",
          patch: shopPatchFromBranch(result as BranchProfile),
        });
      }
      /* Customers render straight off `db.customers` (no `useQuery`), so a
         create/update has to land in the cache itself — a version bump alone
         refetches nothing here. */
      if (
        (method === "createCustomer" || method === "updateCustomer") &&
        result
      ) {
        deps.dispatchQuiet({ type: "upsertCustomer", customer: result as Customer });
      }
      /* POS reads `db.services` directly (no `useQuery`), so a service created
         at the counter has to land in the cache for the picker to see it this
         session. */
      if (method === "createService" && result) {
        deps.dispatchQuiet({ type: "upsertService", service: result as ServiceItem });
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

/** Midnight Manila, as an ISO instant the sales filter understands. */

/**
 * The subset of `ShopProfile` that the branch row owns. `toShopProfile` is the
 * canonical map from the wire; this mirrors it from the already-parsed
 * `BranchProfile` so an edit updates `db.shop` without another round trip.
 */
function shopPatchFromBranch(branch: BranchProfile): Partial<ShopProfile> {
  return {
    name: branch.name,
    addressLine: [branch.addressLine1, branch.addressLine2]
      .filter(Boolean)
      .join(", "),
    city: [branch.city, branch.province].filter(Boolean).join(", "),
    mobile: branch.contactPhone,
    email: branch.contactEmail || undefined,
    vatRegistered: branch.vatRegistered,
    tin: branch.tin || undefined,
    birPermitNo: branch.birPermitNo || undefined,
    receiptFooter: branch.receiptFooterText,
  };
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
/** Pages of recent sales kept in the cache at boot; 15 rows each. */
const SALE_PAGES = 4;

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

  const [freshBranch, customers, users, tickets, items, services, suppliers, sales, shifts] =
    await Promise.all([
      /* The stored session branch can be stale — someone may have edited the
         shop's name or receipt text since sign-in. Re-read it if we can; a
         cashier who cannot list branches just keeps the stored copy. */
      branch
        ? client
            .get<BranchDto>(`/branches/${branch.ulid}`)
            .then((response) => response.data)
            .catch(() => branch)
        : Promise.resolve(null),
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
      /* Catalog plus stock levels plus serialized units, in one shape. */
      loadInventory(client).catch(failed("Inventory", [] as InventoryItem[])),
      client
        .getAll<ServiceDto>("/services")
        .then((rows) => rows.map(toServiceItem))
        .catch(failed("The service list", [] as ServiceItem[])),
      client
        .getAll<SupplierDto>("/suppliers", { query: { sort: "name" } })
        .then((rows) => rows.map(toSupplier))
        .catch(failed("Suppliers", [] as Supplier[])),
      /* Recent sales only. The cache's sales feed one screen — a customer's
         purchase history — and paging the whole ledger at boot cost a dozen
         round trips and tripped the API's rate limiter, twice over under
         `?branch=all`. Figures of record come from `/reports`, never from
         here, so a bounded window costs nothing that matters. */
      client
        .getAll<SaleDto>("/sales", { query: { sort: "-created_at" } }, SALE_PAGES)
        .then((rows) => rows.map(toSale))
        .catch(failed("Sales", [] as Sale[])),
      client
        .getAll<ShiftDto>("/shifts", { query: { sort: "-opened_at" } })
        .then((rows) => rows.map(toShift))
        .catch(failed("Shifts", [] as Shift[])),
    ]);

  return {
    db: {
      ...EMPTY_DB,
      customers,
      users: users.length ? users : self ? [self] : [],
      tickets,
      items,
      services,
      suppliers,
      sales,
      shifts,
      /* Timelines and stock movements are fetched per record, so nothing is
         preloaded here. */
      timeline: [],
      movements: [],
      shop: freshBranch
        ? toShopProfile(freshBranch, EMPTY_DB.shop)
        : EMPTY_DB.shop,
    },
    warnings,
  };
}
