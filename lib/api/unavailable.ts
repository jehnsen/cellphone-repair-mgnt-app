import { ApiError } from "@/lib/api/errors";
import type { ShopApi } from "@/lib/shop/contract";

/**
 * The half of the shop the API has not built yet.
 *
 * Point of sale, the cash drawer, the stock ledger, suppliers, and the sales
 * side of reports have no endpoints. Rather than invent rows to fill the
 * screens, reads answer empty — so every list shows its own empty state — and
 * writes fail loudly with the reason.
 *
 * When an endpoint ships, delete its method here and implement it in
 * `live-api.ts`; nothing else has to change.
 */

const missing = (what: string, endpoint: string) =>
  new ApiError(
    `${what} is not available yet.`,
    `The API has no ${endpoint} endpoint. Nothing was saved.`,
    { code: "NOT_IMPLEMENTED" },
  );

export function createUnavailableApi(): ShopApi {
  return {
    /* Repairs, customers, and the catalog are all implemented live; these
       stubs only stand in until `createLiveApi` overrides them. */
    async getTickets() {
      return [];
    },
    async getTicket() {
      throw missing("Ticket detail", "GET /tickets/{id}");
    },
    async findTicketByCode() {
      return null;
    },
    async getTimeline() {
      return [];
    },
    async getCustomers() {
      return [];
    },
    async getCustomer() {
      throw missing("Customer detail", "GET /customers/{id}");
    },
    async createCustomer() {
      throw missing("Creating a customer", "POST /customers");
    },
    async updateCustomer() {
      throw missing("Updating a customer", "PATCH /customers/{id}");
    },
    async getItems() {
      return [];
    },
    async getItem() {
      throw missing("Item detail", "GET /products/{id}");
    },
    async getUsers() {
      return [];
    },
    async createTicket() {
      throw missing("Creating a job order", "POST /tickets");
    },
    async setTicketStatus() {
      throw missing("Changing ticket status", "POST /tickets/{id}/transition");
    },
    async assignTechnician() {
      throw missing("Assigning a technician", "PATCH /tickets/{id}");
    },
    async addNote() {
      throw missing("Adding a note", "note");
    },
    async markReadyForPickup() {
      throw missing("Marking ready for pickup", "POST /tickets/{id}/transition");
    },
    async releaseTicket() {
      throw missing("Releasing a unit", "POST /tickets/{id}/transition");
    },
    async getDeviceCatalog() {
      return { brands: [], models: [] };
    },

    /* ── Genuinely not built server-side ───────────────────────────── */

    async getMovements() {
      return [];
    },
    async getSuppliers() {
      return [];
    },
    async receiveStock() {
      throw missing("Receiving stock", "goods receipt");
    },
    async adjustStock() {
      throw missing("Adjusting stock", "stock adjustment");
    },
    async getSales() {
      return [];
    },
    async getSale() {
      throw missing("Sale detail", "sales");
    },
    async createSale() {
      throw missing("Ringing up a sale", "point of sale");
    },
    async getShifts() {
      return [];
    },
    async getOpenShift() {
      return null;
    },
    async openShift() {
      throw missing("Opening a shift", "cash drawer");
    },
    async closeShift() {
      throw missing("Closing a shift", "cash drawer");
    },
    async addCashMovement() {
      throw missing("Recording cash in or out", "cash drawer");
    },

    async getDashboard() {
      return {
        todaySales: 0,
        todaySaleCount: 0,
        openTickets: 0,
        byStatus: [],
        overdue: 0,
        readyForPickup: 0,
        lowStock: 0,
        cashOnHand: null,
        openShiftId: null,
        unclaimed: 0,
        awaitingApproval: 0,
      };
    },
  };
}
