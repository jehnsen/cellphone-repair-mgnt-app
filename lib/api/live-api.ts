import { agingOf } from "@/lib/status";
import { transitionPath } from "@/lib/stages";
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
  RepairFindingDto,
  StoreCreditDto,
} from "@/lib/api/dto";
import { toTicketPayment } from "@/lib/api/mappers-commerce";
import {
  promisedDateFor,
  toCustomer,
  toInventoryItem,
  toTicket,
  toTicketStatus,
  toTimelineEvent,
  toUser,
  toRepairFinding,
  toStoreCredit,
  toDeviceBrand,
  toDeviceModel,
  toServiceItem,
} from "@/lib/api/mappers";
import type {
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

/** The API's literal for "every branch", used where a screen must see all. */
const ALL_BRANCHES = "all";

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
      "Ask an owner to assign your account to a branch, then sign in again.",
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

  /* The branch must be the user's own: it is where their writes land. Guessing
     it is not safe once the shop has two sites — a Branch 2 cashier landing on
     Branch 1 would file real job orders against the wrong shop. So only fall
     back to `/branches` when it holds exactly one row and there is nothing to
     confuse; otherwise leave it null and let the app say so. */
  let branch = user.branch ?? null;
  if (!branch) {
    try {
      const branches = await client.get<BranchDto[]>("/branches");
      const rows = branches.data ?? [];
      branch = rows.length === 1 ? rows[0] : null;
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
      /* The board speaks in stages, the server in statuses, and one stage move
         can be two hops (in repair → QC → ready). Walk the legal path so a
         single click never trips 409 INVALID_STATUS_TRANSITION. The note is
         attached to the hop the user actually asked for — the last one. */
      const current = await client.get<RepairTicketDto>(`/tickets/${ticketId}`);
      const path = transitionPath(toTicketStatus(current.data.status), status);
      const hops = path.length ? path : [status];

      let latest = current.data;
      for (const [index, hop] of hops.entries()) {
        const isLast = index === hops.length - 1;
        const { data } = await client.post<RepairTicketDto>(
          `/tickets/${ticketId}/transition`,
          {
            body: {
              to_status: hop,
              note: isLast ? (note?.trim() || null) : null,
            },
          },
        );
        latest = data;
      }

      return toTicket(latest);
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

    async verifyImei({ ticketId, scannedImei, phase = "release", overrideReason }) {
      const clean = scannedImei.replace(/D/g, "");
      /* An override is a separate, logged endpoint — owner only — for a unit
         whose IMEI cannot be read or was mistyped at intake. */
      const path = overrideReason
        ? `/tickets/${ticketId}/imei-verifications/override`
        : `/tickets/${ticketId}/imei-verifications`;

      const { data } = await client.post<{ matches_expected?: boolean }>(path, {
        body: {
          phase,
          scanned_imei: clean,
          ...(overrideReason ? { override_reason: overrideReason } : {}),
        },
      });

      /* A mismatch is recorded, not rejected: the scan happened either way,
         and it is the release guard that acts on the result. */
      return { matches: Boolean(data?.matches_expected) || Boolean(overrideReason) };
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

    async recordPayment({ ticketId, amount, method, reference, tendered }) {
      await recordTicketPayment(client, ticketId, {
        amount,
        method,
        reference,
        /* Cash needs what was handed over so the server can compute change. */
        tendered: method === "cash" ? (tendered ?? amount) : undefined,
      });

      const { data } = await client.get<RepairTicketDto>(`/tickets/${ticketId}`);
      return toTicket(data, await loadTicketExtras(ticketId));
    },

    async addNote() {
      /* The events ledger is append-only server-side and only writes on
         create/update/transition — there is no free-note endpoint yet. */
      throw notImplemented("Adding a standalone note");
    },

    /* ── Findings ──────────────────────────────────────────────────────
       Wired to the contract in docs/backend-findings-spec.md. Until the
       API ships it, GET 404s (read as "none recorded") and PUT surfaces
       whatever the server says. No frontend change needed on ship. */

    async getFinding(ticketId) {
      try {
        const { data } = await client.get<RepairFindingDto>(
          `/tickets/${ticketId}/finding`,
        );
        return toRepairFinding(data);
      } catch (caught) {
        /* No findings yet is the normal case, not an error. */
        if (caught instanceof ApiError && caught.code === "NOT_FOUND") return null;
        throw caught;
      }
    },

    async saveFinding({ ticketId, ...input }) {
      try {
        const { data } = await client.put<RepairFindingDto>(
          `/tickets/${ticketId}/finding`,
          {
            body: {
              summary: input.summary.trim(),
              details: input.details?.trim() || null,
              root_cause: input.rootCause,
              defects: input.defects,
              resolution: input.resolution,
              technician_notes: input.technicianNotes?.trim() || null,
              qc_passed: input.qcPassed ?? null,
            },
          },
        );
        return toRepairFinding(data);
      } catch (caught) {
        /* A 404 on a PUT means the route is missing, not the ticket — the
           ticket was just loaded. Say which, or the bench is told to go look
           for a record that is sitting right in front of them. */
        if (caught instanceof ApiError && caught.code === "NOT_FOUND") {
          throw new ApiError(
            "Recording findings is not in the API yet.",
            "The findings endpoint has not shipped. Nothing was saved — keep the details in a ticket note for now.",
            { code: "NOT_IMPLEMENTED" },
          );
        }
        throw caught;
      }
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

    /* ── Store credit ──────────────────────────────────────────────── */

    async getStoreCredit(customerId) {
      const { data } = await client.get<StoreCreditDto>(
        `/customers/${customerId}/store-credit`,
      );
      return toStoreCredit(customerId, data);
    },

    async adjustStoreCredit({ customerId, direction, amount, reason }) {
      await client.post(`/customers/${customerId}/store-credit/adjust`, {
        body: {
          direction,
          amount: money(amount),
          reason: reason.trim(),
        },
      });
      /* The adjust response is the single entry; re-read for the fresh
         balance and the ledger the panel renders. */
      const { data } = await client.get<StoreCreditDto>(
        `/customers/${customerId}/store-credit`,
      );
      return toStoreCredit(customerId, data);
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

    /* ── Device reference data (managed under Settings → Devices) ──────
       The active-only `getDeviceCatalog` above feeds the pickers; these
       return everything so an inactive row can be edited back on. */

    async getDeviceBrands() {
      const rows = await client.getAll<DeviceBrandDto>("/device-brands", {
        query: { sort: "name" },
      });
      return rows.map(toDeviceBrand);
    },

    async createDeviceBrand({ name }) {
      const { data } = await client.post<DeviceBrandDto>("/device-brands", {
        body: { name: name.trim(), is_active: true },
      });
      return toDeviceBrand(data);
    },

    async updateDeviceBrand({ id, name, active }) {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name.trim();
      if (active !== undefined) body.is_active = active;
      const { data } = await client.patch<DeviceBrandDto>(`/device-brands/${id}`, {
        body,
      });
      return toDeviceBrand(data);
    },

    async deleteDeviceBrand(id) {
      await client.delete(`/device-brands/${id}`);
    },

    async getDeviceModels() {
      const rows = await client.getAll<DeviceModelDto>("/device-models", {
        query: { sort: "name" },
      });
      return rows.map(toDeviceModel);
    },

    async createDeviceModel({ brandId, name, releaseYear }) {
      const { data } = await client.post<DeviceModelDto>("/device-models", {
        body: {
          device_brand_ulid: brandId,
          name: name.trim(),
          release_year: releaseYear ?? null,
          is_active: true,
        },
      });
      return toDeviceModel(data);
    },

    async updateDeviceModel({ id, name, brandId, releaseYear, active }) {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name.trim();
      if (brandId !== undefined) body.device_brand_ulid = brandId;
      if (releaseYear !== undefined) body.release_year = releaseYear;
      if (active !== undefined) body.is_active = active;
      const { data } = await client.patch<DeviceModelDto>(`/device-models/${id}`, {
        body,
      });
      return toDeviceModel(data);
    },

    async deleteDeviceModel(id) {
      await client.delete(`/device-models/${id}`);
    },

    /* ── Services ──────────────────────────────────────────────────────
       The counter needs to ring up one-off labour. The server prices a
       service line from the service record (no per-line override), so the
       one-off is created here as a catalog row and then sold like any
       other. */

    async createService({ name, price, category }) {
      const { data } = await client.post<ServiceDto>("/services", {
        body: {
          name: name.trim(),
          default_price: money(price),
          category: category?.trim() || "custom",
          is_active: true,
        },
      });
      return toServiceItem(data);
    },

    /* ── People ────────────────────────────────────────────────────── */

    async getUsers() {
      try {
        /* Across the business, not just the branch the switcher is on: staff
           management has to reach the other site's cashiers. The server still
           decides — anyone without `branches.view_all` gets a 403 here. */
        const rows = await client.getAll<UserDto>("/users", {
          query: { branch: ALL_BRANCHES },
        });
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

    /* Staff writes. `role` is a single name on the wire, not the array the
       resource returns, and `branch_ulid` decides where that person's work
       lands — so the form asks for both explicitly rather than defaulting. */
    async createUser(input) {
      const { data } = await client.post<UserDto>("/users", {
        query: { branch: ALL_BRANCHES },
        body: {
          branch_ulid: input.branchId,
          employee_code: input.employeeCode,
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
        },
      });
      return toUser(data);
    },

    async updateUser(id, patch) {
      /* Only the keys actually edited are sent: a blank password field means
         "leave it alone", never "clear it". */
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.email !== undefined) body.email = patch.email;
      if (patch.password) body.password = patch.password;
      if (patch.role !== undefined) body.role = patch.role;
      if (patch.employeeCode !== undefined) {
        body.employee_code = patch.employeeCode;
      }
      if (patch.branchId !== undefined) body.branch_ulid = patch.branchId;
      if (patch.active !== undefined) body.is_active = patch.active;

      const { data } = await client.patch<UserDto>(`/users/${id}`, {
        query: { branch: ALL_BRANCHES },
        body,
      });
      return toUser(data);
    },

    async deleteUser(id) {
      await client.delete(`/users/${id}`, {
        query: { branch: ALL_BRANCHES },
      });
    },

    async updateProfile(input) {
      const self = context.currentUser();
      if (!self?.id) {
        throw new ApiError(
          "No signed-in user to update.",
          "Sign out and sign in again.",
          { code: "UNAUTHENTICATED" },
        );
      }

      const body: Record<string, unknown> = {};
      if (input.name !== undefined) body.name = input.name.trim();
      if (input.email !== undefined) body.email = input.email.trim();
      /* Only sent when actually changing it — an empty field is not "clear the
         password", it is "leave it". */
      if (input.password) body.password = input.password;

      const { data } = await client.patch<UserDto>(`/users/${self.id}`, { body });
      return toUser(data);
    },
  };
}

export type { Customer, ID, ServiceDto };
