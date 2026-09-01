import { ApiError } from "@/lib/api/errors";
import type { HttpClient } from "@/lib/api/http";
import type { LiveContext } from "@/lib/api/live-api";
import type { BranchDto, MessageTemplateDto, SettingDto } from "@/lib/api/dto";
import {
  toBranchProfile,
  toBranchSummary,
  toMessageTemplate,
  toShopSetting,
} from "@/lib/api/mappers";
import type {
  BranchPatch,
  NewMessageTemplateInput,
  ShopApi,
} from "@/lib/shop/contract";

/**
 * `ShopApi` for the config surfaces the API serves: the branch profile
 * (`/branches/{ulid}`), branch key/value settings (`/settings`), and message
 * templates (`/message-templates`). All are gated server-side by
 * `settings.manage`; a cashier or technician gets a 403, which the screen
 * surfaces as a "not permitted" empty state rather than a crash.
 *
 * Settings is a flat key/value map on the wire — no pagination, one GET — and
 * `PUT` is a partial upsert: only the keys in the payload are touched, and a
 * `null` clears this branch's override.
 */
export function createSettingsApi(
  client: HttpClient,
  context: LiveContext,
): Partial<ShopApi> {
  const branchUlid = () => {
    const ulid = context.branchUlid();
    if (!ulid) {
      throw new ApiError(
        "No branch is attached to this session.",
        "Sign out and sign in again so the shop's branch can be loaded.",
        { code: "FORBIDDEN" },
      );
    }
    return ulid;
  };

  return {
    async getBranch() {
      const { data } = await client.get<BranchDto>(`/branches/${branchUlid()}`);
      return toBranchProfile(data);
    },

    /* Whatever this token is allowed to see. A cashier is scoped server-side
       to their own branch, so this comes back with one row — or 403s, which
       is not an error here: it just means there is nothing to switch to. */
    async getBranches(options = {}) {
      try {
        const rows = await client.getAll<BranchDto>("/branches", {
          query: { sort: "name" },
        });
        const all = rows.map(toBranchSummary);
        /* The switcher wants somewhere you can actually work; management wants
           the closed sites too, so they can be reopened. */
        return options.includeInactive ? all : all.filter((b) => b.active);
      } catch (error) {
        if (error instanceof ApiError && error.code === "FORBIDDEN") return [];
        throw error;
      }
    },

    async createBranch(input) {
      const { data } = await client.post<BranchDto>("/branches", {
        body: {
          name: input.name,
          code: input.code,
          type: input.kind,
          offers_repairs: input.kind !== "sales_only",
          timezone: "Asia/Manila",
          is_active: true,
        },
      });
      return toBranchSummary(data);
    },

    async updateBranchById(id, patch) {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.code !== undefined) body.code = patch.code;
      if (patch.kind !== undefined) {
        body.type = patch.kind;
        /* The two travel together: a sales-only floor has no repair bench. */
        body.offers_repairs = patch.kind !== "sales_only";
      }
      if (patch.active !== undefined) body.is_active = patch.active;

      const { data } = await client.patch<BranchDto>(`/branches/${id}`, { body });
      return toBranchSummary(data);
    },

    async updateBranch(patch: BranchPatch) {
      /* Domain field names → the flat snake_case the API validates. Only the
         keys actually present are sent, so an untouched field is never
         cleared. `null` (not "") clears an optional column. */
      const body: Record<string, unknown> = {};
      const set = (key: string, value: string | undefined, nullable = true) => {
        if (value === undefined) return;
        body[key] = value === "" && nullable ? null : value;
      };
      set("name", patch.name, false);
      set("legal_name", patch.legalName);
      set("address_line1", patch.addressLine1);
      set("address_line2", patch.addressLine2);
      set("city", patch.city);
      set("province", patch.province);
      set("postal_code", patch.postalCode);
      set("contact_phone", patch.contactPhone);
      set("contact_email", patch.contactEmail);
      set("tin", patch.tin);
      set("bir_permit_no", patch.birPermitNo);
      set("receipt_header_text", patch.receiptHeaderText);
      set("receipt_footer_text", patch.receiptFooterText);
      if (patch.vatRegistered !== undefined) {
        body.vat_registered = patch.vatRegistered;
      }

      const { data } = await client.patch<BranchDto>(
        `/branches/${branchUlid()}`,
        { body },
      );
      return toBranchProfile(data);
    },

    async getSettings() {
      const { data } = await client.get<SettingDto[]>("/settings");
      return (data ?? []).map(toShopSetting);
    },

    async updateSettings(patch) {
      const { data } = await client.put<SettingDto[]>("/settings", {
        body: { settings: patch },
      });
      return (data ?? []).map(toShopSetting);
    },

    async getMessageTemplates() {
      const rows = await client.getAll<MessageTemplateDto>("/message-templates", {
        query: { sort: "event_key" },
      });
      return rows.map(toMessageTemplate);
    },

    async createMessageTemplate(input: NewMessageTemplateInput) {
      const { data } = await client.post<MessageTemplateDto>("/message-templates", {
        body: {
          channel: input.channel,
          event_key: input.eventKey,
          body: input.body,
          is_active: input.active ?? true,
        },
      });
      return toMessageTemplate(data);
    },

    async updateMessageTemplate({ id, body, active }) {
      const payload: Record<string, unknown> = {};
      if (body !== undefined) payload.body = body;
      if (active !== undefined) payload.is_active = active;

      const { data } = await client.patch<MessageTemplateDto>(
        `/message-templates/${id}`,
        { body: payload },
      );
      return toMessageTemplate(data);
    },
  };
}
