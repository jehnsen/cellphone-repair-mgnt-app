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
    async getStoreCredit() {
      return { customerId: "", balance: 0, ledger: [] };
    },
    async adjustStoreCredit() {
      throw missing(
        "Adjusting store credit",
        "POST /customers/{id}/store-credit/adjust",
      );
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
    async updateProfile() {
      throw missing("Updating your profile", "PATCH /users/{ulid}");
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
    async verifyImei() {
      throw missing("Verifying the IMEI", "POST /tickets/{id}/imei-verifications");
    },
    async releaseTicket() {
      throw missing("Releasing a unit", "POST /tickets/{id}/transition");
    },
    async getDeviceCatalog() {
      return { brands: [], models: [] };
    },
    async getDeviceBrands() {
      return [];
    },
    async createDeviceBrand() {
      throw missing("Adding a device brand", "POST /device-brands");
    },
    async updateDeviceBrand() {
      throw missing("Editing a device brand", "PATCH /device-brands/{ulid}");
    },
    async deleteDeviceBrand() {
      throw missing("Deleting a device brand", "DELETE /device-brands/{ulid}");
    },
    async getDeviceModels() {
      return [];
    },
    async createDeviceModel() {
      throw missing("Adding a device model", "POST /device-models");
    },
    async updateDeviceModel() {
      throw missing("Editing a device model", "PATCH /device-models/{ulid}");
    },
    async deleteDeviceModel() {
      throw missing("Deleting a device model", "DELETE /device-models/{ulid}");
    },
    async getMovements() {
      return [];
    },
    async getSuppliers() {
      return [];
    },
    async getProductRefs() {
      return { categories: [], brands: [] };
    },
    async createItem() {
      throw missing("Adding an item", "POST /products");
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
    async createService() {
      throw missing("Adding a service", "POST /services");
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
    async recordPayment() {
      throw missing("Recording a payment", "POST /tickets/{id}/payments");
    },

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

    /* Config surfaces. The live client (`createSettingsApi`) overrides these
       whenever the account can reach them; the floor answers empty for a read
       and fails loudly for a write, same as everywhere else. */
    async getBranch() {
      throw missing("The branch profile", "GET /branches/{ulid}");
    },
    async updateBranch() {
      throw missing("Updating the branch profile", "PATCH /branches/{ulid}");
    },
    /* Empty means "nothing to switch to", which the switcher hides. */
    async getBranches() {
      return [];
    },
    async createBranch() {
      throw missing("Adding a branch", "POST /branches");
    },
    async updateBranchById() {
      throw missing("Editing a branch", "PATCH /branches/{ulid}");
    },
    async createUser() {
      throw missing("Creating a staff account", "POST /users");
    },
    async updateUser() {
      throw missing("Editing a staff account", "PATCH /users/{ulid}");
    },
    async deleteUser() {
      throw missing("Removing a staff account", "DELETE /users/{ulid}");
    },
    async getSettings() {
      return [];
    },
    async updateSettings() {
      throw missing("Updating settings", "PUT /settings");
    },
    async getMessageTemplates() {
      return [];
    },
    async createMessageTemplate() {
      throw missing("Creating a message template", "POST /message-templates");
    },
    async updateMessageTemplate() {
      throw missing("Updating a message template", "PATCH /message-templates/{ulid}");
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
        stockValue: null,
        branches: [],
      };
    },
  };
}
