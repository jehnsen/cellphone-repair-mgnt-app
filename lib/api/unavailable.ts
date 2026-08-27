import { ApiError } from "@/lib/api/errors";
import type { ShopApi } from "@/lib/shop/contract";

/**
 * The floor under the live client.
 *
 * Every `ShopApi` method has an implementation here so the object is always
 * complete; `createLiveApi` and `createCommerceApi` override the ones the
 * server actually serves. What is left over answers honestly: reads come back
 * empty, writes fail with the reason rather than pretending to save.
 *
 * As of the current API, only `addNote` survives this file at runtime — the
 * event ledger writes on create, update, and transition, and has no
 * free-standing note endpoint.
 */

const missing = (what: string, endpoint: string) =>
  new ApiError(
    `${what} is not available yet.`,
    `The API has no ${endpoint} endpoint. Nothing was saved.`,
    { code: "NOT_IMPLEMENTED" },
  );

export function createUnavailableApi(): ShopApi {
  return {
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
    async markReadyForPickup() {
      throw missing("Marking ready for pickup", "POST /tickets/{id}/transition");
    },
    async releaseTicket() {
      throw missing("Releasing a unit", "POST /tickets/{id}/transition");
    },
    async getDeviceCatalog() {
      return { brands: [], models: [] };
    },
    async getMovements() {
      return [];
    },
    async getSuppliers() {
      return [];
    },
    async receiveStock() {
      throw missing("Receiving stock", "POST /goods-receipts");
    },
    async adjustStock() {
      throw missing("Adjusting stock", "POST /stock-adjustments");
    },
    async getSales() {
      return [];
    },
    async getSale() {
      throw missing("Sale detail", "GET /sales/{id}");
    },
    async createSale() {
      throw missing("Ringing up a sale", "POST /sales");
    },
    async getShifts() {
      return [];
    },
    async getOpenShift() {
      return null;
    },
    async openShift() {
      throw missing("Opening a shift", "POST /shifts/open");
    },
    async closeShift() {
      throw missing("Closing a shift", "POST /shifts/{id}/close");
    },
    async addCashMovement() {
      throw missing("Recording cash in or out", "POST /shifts/{id}/cash-movements");
    },

    /* Still genuinely absent: the ledger only writes on create, update, and
       transition, so a note with no status change has nowhere to go. */
    async addNote() {
      throw missing("Adding a standalone note", "ticket note");
    },

    /* Findings are specced but not built server-side yet — see
       docs/backend-findings-spec.md. Reading answers "none recorded" so the
       detail page renders; saving fails loudly rather than losing the work. */
    async getFinding() {
      return null;
    },
    async saveFinding() {
      throw missing("Recording findings", "PUT /tickets/{ulid}/finding");
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
