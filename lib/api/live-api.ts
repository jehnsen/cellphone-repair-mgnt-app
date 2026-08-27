import { agingOf, STATUS_META } from "@/lib/status";
import { money } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { HttpClient } from "@/lib/api/http";
import type {
  BranchDto,
  CustomerDeviceDto,
  CustomerDto,
  DeviceBrandDto,
  DeviceModelDto,
  ProductDto,
  RepairTicketDto,
  ServiceDto,
  TicketEventDto,
  TicketLineDto,
  TicketPhotoDto,
  PaymentDto,
  TicketQuoteDto,
  TokenDto,
  UserDto,
} from "@/lib/api/dto";
import { toTicketPayment } from "@/lib/api/mappers-commerce";
import {
  promisedDateFor,
  toCustomer,
  toInventoryItem,
  toTicket,
  toTimelineEvent,
  toUser,
} from "@/lib/api/mappers";
import type {
  DashboardSummary,
  DeviceCatalog,
  NewTicketInput,
  ShopApi,
} from "@/lib/shop/contract";
import type { TicketQuery } from "@/lib/shop/queries";
import type { Customer, ID, Ticket, TicketStatus, User } from "@/lib/types";

/**
 * The live client: `ShopApi` implemented over the Laravel API.
 *
 * It covers what the API actually serves — repairs, customers, devices,
 * catalog, users. Everything it does not implement is left to
 * `createUnavailableApi`, which answers empty rather than inventing rows.
 */

export interface LiveContext {
  /** Every branch-scoped write needs this. */
  branchUlid: () => string | null;
  /** Who we are, for the local half of any optimistic shape. */
  currentUser: () => User | null;
}

const notImplemented = (what: string) =>
  new ApiError(
    `${what} is not in the API yet.`,
    "The API covers repairs, customers, devices, and the catalog. Nothing was saved.",
    { code: "NOT_IMPLEMENTED" },
  );

function requireBranch(context: LiveContext): string {
  const branch = context.branchUlid();
  if (!branch) {
    throw new ApiError(
      "No branch is attached to this session.",
      "Sign out and sign in again so the shop's branch can be loaded.",
      { code: "FORBIDDEN" },
    );
  }
  return branch;
}

/* ── Auth, called by the store before the API is built ───────────────── */

export async function signIn(
  client: HttpClient,
  credentials: { email: string; password: string },
): Promise<{ token: string; user: UserDto; branch: BranchDto | null }> {
  const { data } = await client.post<TokenDto>("/auth/token", {
    body: { ...credentials, device_name: "job-order-web" },
  });

  client.setToken(data.token);

  /* The token endpoint does not return the user, and /users needs
     `users.view` — which a cashier or technician does not have. Fall back to
     a minimal identity built from the credentials rather than failing login. */
  let user: UserDto | null = null;
  try {
    const found = await client.get<UserDto[]>("/users", {
      query: { "filter[email]": credentials.email },
    });
    user = found.data?.[0] ?? null;
  } catch {
    user = null;
  }

  if (!user) {
    user = {
      ulid: `local-${credentials.email}`,
      name: credentials.email.split("@")[0]?.replace(/[._]/g, " ") ?? "Staff",
      email: credentials.email,
      roles: ["cashier"],
      is_active: true,
    };
  }

  let branch = user.branch ?? null;
  if (!branch) {
    try {
      const branches = await client.get<BranchDto[]>("/branches");
      branch = branches.data?.[0] ?? null;
    } catch {
      branch = null;
    }
  }

  return { token: data.token, user, branch };
}

export async function signOutRemote(client: HttpClient): Promise<void> {
  try {
    await client.post("/auth/logout");
  } catch {
    /* A dead token is already signed out as far as the app is concerned. */
  }
}

/**
 * Money on a ticket goes through its own endpoint — a repair is never wrapped
 * in a sale to collect payment. Used by release, and by the payments tab.
 */
export async function recordTicketPayment(
  client: HttpClient,
  ticketUlid: string,
  payment: { amount: number; method: string; reference?: string; tendered?: number },
): Promise<void> {
  await client.post(`/tickets/${ticketUlid}/payments`, {
    body: {
      method: payment.method,
      amount: money(payment.amount),
      reference_number: payment.reference ?? null,
      tendered: payment.tendered ?? null,
    },
  });
}

/* ── The client ──────────────────────────────────────────────────────── */

export function createLiveApi(
  client: HttpClient,
  context: LiveContext,
): Partial<ShopApi> {
  /** Ticket detail needs four calls the list does not; keep them together. */
  const loadTicketExtras = async (ulid: string) => {
    const [lines, photos, quotes, payments] = await Promise.all([
      client
        .get<TicketLineDto[]>(`/tickets/${ulid}/lines`)
        .then((response) => response.data ?? [])
        .catch(() => [] as TicketLineDto[]),
      client
        .get<TicketPhotoDto[]>(`/tickets/${ulid}/photos`)
        .then((response) => response.data ?? [])
        .catch(() => [] as TicketPhotoDto[]),
      client
        .get<TicketQuoteDto[]>(`/tickets/${ulid}/quotes`)
        .then((response) => response.data ?? [])
        .catch(() => [] as TicketQuoteDto[]),
      client
        .get<PaymentDto[]>(`/tickets/${ulid}/payments`)
        .then((response) => response.data ?? [])
        .catch(() => [] as PaymentDto[]),
    ]);
    return { lines, photos, quotes, payments };
  };

  /* Only the filters the server allow-lists are pushed down; the rest are
     applied here, because `filter[assigned_technician_id]` wants an internal
     id the API never exposes. */
  const fetchTickets = async (query: TicketQuery = {}): Promise<Ticket[]> => {
    const serverQuery: Record<string, string | undefined> = {};
    if (query.search) serverQuery["filter[search]"] = query.search.trim();
    if (query.overdueOnly) serverQuery["filter[overdue]"] = "true";
    if (query.status?.length === 1) serverQuery["filter[status]"] = query.status[0];
    serverQuery.sort = "-created_at";

    const rows = await client.getAll<RepairTicketDto>("/tickets", {
      query: serverQuery,
    });

    const now = new Date();
    return rows
      .map((dto) => toTicket(dto))
      .filter((ticket) => {
        if (query.status?.length && !query.status.includes(ticket.status)) return false;
        if (query.technicianId && ticket.technicianId !== query.technicianId) {
          return false;
        }
        if (query.brand && ticket.device.brand !== query.brand) return false;
        if (query.includeReleased === false && ticket.status === "released") {
          return false;
        }
        if (query.overdueOnly && agingOf(ticket, now).tier !== "overdue") return false;
        if (query.from && new Date(ticket.createdAt) < new Date(query.from)) return false;
        if (query.to && new Date(ticket.createdAt) > new Date(query.to)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.promisedAt).getTime() - new Date(b.promisedAt).getTime(),
      );
  };

  /* Intake gives us a brand, a model, and an IMEI as plain text. The API wants
     three related records to exist first, so find them or make them. */
  const ensureBrand = async (name: string): Promise<string> => {
    const clean = name.trim();
    const existing = await client.get<DeviceBrandDto[]>("/device-brands", {
      query: { "filter[name]": clean },
    });
    const match = existing.data?.find(
      (brand) => brand.name.toLowerCase() === clean.toLowerCase(),
    );
    if (match) return match.ulid;

    const created = await client.post<DeviceBrandDto>("/device-brands", {
      body: { name: clean, is_active: true },
    });
    return created.data.ulid;
  };

  const ensureModel = async (brandUlid: string, name: string): Promise<string> => {
    const clean = name.trim();
    const existing = await client.get<DeviceModelDto[]>("/device-models", {
      query: { "filter[name]": clean },
    });
    const match = existing.data?.find(
      (model) =>
        model.name.toLowerCase() === clean.toLowerCase() &&
        (!model.brand || model.brand.ulid === brandUlid),
    );
    if (match) return match.ulid;

    const created = await client.post<DeviceModelDto>("/device-models", {
      body: { device_brand_ulid: brandUlid, name: clean, is_active: true },
    });
    return created.data.ulid;
  };

  const ensureDevice = async (
    customerUlid: string,
    modelUlid: string,
    imei: string,
    color: string,
  ): Promise<string> => {
    const clean = imei.replace(/\D/g, "");
    const devices = await client.get<CustomerDeviceDto[]>(
      `/customers/${customerUlid}/devices`,
    );
    const match = devices.data?.find(
      (device) => (device.imei ?? "").replace(/\D/g, "") === clean,
    );
    if (match) return match.ulid;

    const created = await client.post<CustomerDeviceDto>(
      `/customers/${customerUlid}/devices`,
      {
        body: {
          device_model_ulid: modelUlid,
          /* 15-digit IMEIs are Luhn-checked server-side; anything else is a
             serial, which the API takes in its own field. */
          imei: clean.length === 15 ? clean : null,
          serial_number: clean.length === 15 ? null : imei.trim() || null,
          color: color || null,
        },
      },
    );
    return created.data.ulid;
  };

  return {
    /* ── Tickets ───────────────────────────────────────────────────── */

    async getTickets(query = {}) {
      return fetchTickets(query);
    },

    async getTicket(id) {
      const [{ data }, extras] = await Promise.all([
        client.get<RepairTicketDto>(`/tickets/${id}`),
        loadTicketExtras(id),
      ]);
      return toTicket(data, extras);
    },

    async findTicketByCode(code) {
      const needle = code.trim().replace(/-/g, "").toUpperCase();
      if (!needle) return null;

      const rows = await client.getAll<RepairTicketDto>("/tickets", {
        query: { "filter[search]": code.trim() },
      });

      const match =
        rows.find(
          (dto) =>
            dto.claim_code?.toUpperCase() === needle ||
            dto.ticket_number?.toUpperCase() === code.trim().toUpperCase() ||
            (dto.customer_device?.imei ?? "").replace(/\D/g, "") === needle,
        ) ?? rows[0];

      if (!match) return null;
      return toTicket(match, await loadTicketExtras(match.ulid));
    },

    async getTimeline(ticketId) {
      const { data } = await client.get<TicketEventDto[]>(
        `/tickets/${ticketId}/events`,
      );
      return (data ?? [])
        .map((dto, index) => toTimelineEvent(dto, ticketId, index))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },

    async createTicket(input: NewTicketInput) {
      const branchUlid = requireBranch(context);

      let customerUlid = input.customerId;
      if (!customerUlid && input.newCustomer) {
        const created = await client.post<CustomerDto>("/customers", {
          body: {
            branch_ulid: branchUlid,
            name: input.newCustomer.name,
            mobile: input.newCustomer.mobile,
            email: input.newCustomer.email || null,
          },
        });
        customerUlid = created.data.ulid;
      }
      if (!customerUlid) {
        throw new ApiError(
          "This job order has no customer.",
          "Pick an existing customer or fill in the new-customer fields.",
          { code: "VALIDATION_FAILED" },
        );
      }

      const brandUlid = await ensureBrand(input.device.brand || "Unknown");
      const modelUlid = await ensureModel(brandUlid, input.device.model || "Unknown");
      const deviceUlid = await ensureDevice(
        customerUlid,
        modelUlid,
        input.device.imei,
        input.device.color,
      );

      const { data } = await client.post<RepairTicketDto>("/tickets", {
        body: {
          branch_ulid: branchUlid,
          customer_ulid: customerUlid,
          customer_device_ulid: deviceUlid,
          assigned_technician_ulid: input.technicianId ?? null,
          reported_problem: input.reportedProblem,
          problem_tags: input.problemTags,
          unlock_method: input.device.unlockMethod,
          unlock_value:
            input.device.unlockMethod === "none"
              ? null
              : (input.device.unlockValue ?? null),
          accessories_turned_over: input.turnedOver,
          intake_condition_checklist: input.conditionChecks,
          estimated_cost: input.estimatedCost,
          downpayment: input.downpayment,
          promised_date: promisedDateFor(input.promisedAt),
          warranty_days_offered: input.warrantyDays,
          terms_accepted: true,
        },
      });

      return toTicket(data);
    },

    async setTicketStatus({ ticketId, status, note }) {
      const { data } = await client.post<RepairTicketDto>(
        `/tickets/${ticketId}/transition`,
        { body: { to_status: status, note: note?.trim() || null } },
      );
      return toTicket(data);
    },

    async assignTechnician({ ticketIds, technicianId }) {
      const updated: Ticket[] = [];
      for (const id of ticketIds) {
        const { data } = await client.patch<RepairTicketDto>(`/tickets/${id}`, {
          body: { assigned_technician_ulid: technicianId },
        });
        updated.push(toTicket(data));
      }
      return updated;
    },

    async markReadyForPickup({ ticketIds }) {
      const updated: Ticket[] = [];
      for (const id of ticketIds) {
        const { data } = await client.post<RepairTicketDto>(
          `/tickets/${id}/transition`,
          { body: { to_status: "ready_for_pickup", note: null } },
        );
        updated.push(toTicket(data));
      }
      return updated;
    },

    async releaseTicket({ ticketId, releasedTo, payment }) {
      /* Settle the balance first — the server refuses to release a ticket that
         still owes money, and refuses edits once it is released. This posts a
         real payment against the ticket rather than nudging `downpayment`. */
      if (payment && payment.amount > 0) {
        await recordTicketPayment(client, ticketId, {
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference,
          tendered: payment.method === "cash" ? payment.amount : undefined,
        });
      }

      const { data } = await client.post<RepairTicketDto>(
        `/tickets/${ticketId}/transition`,
        {
          body: {
            to_status: "released",
            note: releasedTo ? `Released to ${releasedTo}.` : null,
          },
        },
      );

      const ticket = toTicket(data, await loadTicketExtras(ticketId));
      return { ...ticket, releasedTo };
    },

    async addNote() {
      /* The events ledger is append-only server-side and only writes on
         create/update/transition — there is no free-note endpoint yet. */
      throw notImplemented("Adding a standalone note");
    },

    /* ── Customers ─────────────────────────────────────────────────── */

    async getCustomers(query = {}) {
      const rows = await client.getAll<CustomerDto>("/customers", {
        query: query.search ? { "filter[name]": query.search.trim() } : undefined,
      });

      const needle = query.search?.trim().toLowerCase();
      const mapped = rows.map(toCustomer);

      /* `filter[name]` is name-only; the counter also searches by number. */
      if (!needle) return mapped;
      const byName = mapped.filter((customer) =>
        `${customer.name} ${customer.mobile} ${customer.email ?? ""}`
          .toLowerCase()
          .includes(needle),
      );
      if (byName.length) return byName;

      const byMobile = await client.getAll<CustomerDto>("/customers", {
        query: { "filter[mobile]": query.search!.trim() },
      });
      return byMobile.map(toCustomer);
    },

    async getCustomer(id) {
      const { data } = await client.get<CustomerDto>(`/customers/${id}`);
      return toCustomer(data);
    },

    async createCustomer(input) {
      const branchUlid = requireBranch(context);
      const { data } = await client.post<CustomerDto>("/customers", {
        body: {
          branch_ulid: branchUlid,
          name: input.name,
          mobile: input.mobile,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
        },
      });
      return toCustomer(data);
    },

    async updateCustomer({ id, ...patch }) {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.mobile !== undefined) body.mobile = patch.mobile;
      if (patch.email !== undefined) body.email = patch.email || null;
      if (patch.address !== undefined) body.address = patch.address || null;
      if (patch.notes !== undefined) body.notes = patch.notes || null;

      const { data } = await client.patch<CustomerDto>(`/customers/${id}`, { body });
      return toCustomer(data);
    },

    /* ── Catalog ───────────────────────────────────────────────────── */

    async getItems(query = {}) {
      const serverQuery: Record<string, string | undefined> = {};
      if (query.itemClass) {
        serverQuery["filter[type]"] =
          query.itemClass === "spare_part" ? "part" : query.itemClass;
      }
      if (query.search) serverQuery["filter[name]"] = query.search.trim();
      serverQuery.include = "compatibleDeviceModels";

      const rows = await client.getAll<ProductDto>("/products", {
        query: serverQuery,
      });
      const items = rows.map(toInventoryItem);

      const needle = query.search?.trim().toLowerCase();
      return needle
        ? items.filter((item) =>
            `${item.name} ${item.sku} ${item.brand} ${item.barcode ?? ""}`
              .toLowerCase()
              .includes(needle),
          )
        : items;
    },

    async getItem(id) {
      const { data } = await client.get<ProductDto>(`/products/${id}`, {
        query: { include: "compatibleDeviceModels" },
      });
      return toInventoryItem(data);
    },

    /* ── Device reference lists ────────────────────────────────────── */

    async getDeviceCatalog(): Promise<DeviceCatalog> {
      const [brandRows, modelRows] = await Promise.all([
        client.getAll<DeviceBrandDto>("/device-brands", {
          query: { "filter[is_active]": "true", sort: "name" },
        }),
        client.getAll<DeviceModelDto>("/device-models", {
          query: { "filter[is_active]": "true", sort: "name" },
        }),
      ]);

      const models = modelRows
        .map((model) => ({ brand: model.brand?.name ?? "", model: model.name }))
        .filter((entry) => entry.brand);

      /* Brands with no model yet still belong in the picker. */
      const brands = Array.from(
        new Set([...brandRows.map((brand) => brand.name), ...models.map((m) => m.brand)]),
      ).sort((a, b) => a.localeCompare(b));

      return { brands, models };
    },

    /* ── People ────────────────────────────────────────────────────── */

    async getUsers() {
      try {
        const rows = await client.getAll<UserDto>("/users");
        return rows.map(toUser);
      } catch (caught) {
        /* Cashiers and technicians cannot list users; they only need to see
           themselves for "assigned to me". */
        if (caught instanceof ApiError && caught.code === "FORBIDDEN") {
          const self = context.currentUser();
          return self ? [self] : [];
        }
        throw caught;
      }
    },
  };
}

/**
 * Ticket-derived dashboard numbers, computed from whatever the live client
 * returned. Sales, drawer, and stock come from the mock half — the API has no
 * endpoints for them yet.
 */
export function dashboardFromTickets(
  tickets: Ticket[],
  base: DashboardSummary,
): DashboardSummary {
  const now = new Date();
  const open = tickets.filter((ticket) => !STATUS_META[ticket.status].terminal);

  return {
    ...base,
    openTickets: open.length,
    byStatus: Object.values(STATUS_META)
      .filter((meta) => meta.onBoard)
      .map((meta) => ({
        status: meta.status as TicketStatus,
        count: tickets.filter((ticket) => ticket.status === meta.status).length,
      })),
    overdue: open.filter((ticket) => agingOf(ticket, now).tier === "overdue").length,
    readyForPickup: tickets.filter((ticket) => ticket.status === "ready_for_pickup")
      .length,
    unclaimed: tickets.filter((ticket) => ticket.status === "unclaimed").length,
    awaitingApproval: tickets.filter((ticket) => ticket.status === "awaiting_approval")
      .length,
  };
}

export type { Customer, ID, ServiceDto };
