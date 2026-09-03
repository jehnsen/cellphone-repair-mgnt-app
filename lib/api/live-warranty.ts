import type { HttpClient, QueryValue } from "@/lib/api/http";
import type {
  SaleWarrantyClaimDto,
  SaleWarrantyDto,
  SupplierReturnDto,
} from "@/lib/api/dto";
import {
  toSaleWarranty,
  toSaleWarrantyClaim,
  toSupplierReturn,
} from "@/lib/api/mappers-warranty";
import type { ShopApi } from "@/lib/shop/contract";
import type { Paged } from "@/lib/types";

/**
 * The sale-side warranty client: the warranty a serialized unit ships with,
 * the claims against it, and supplier returns.
 *
 * These entities are never folded into `db` — like the reports, every read
 * goes to the server. Lists are page-paginated; the helper below turns the
 * `{ data, meta }` envelope into the `Paged<T>` a screen draws Prev/Next from.
 */

const PER_PAGE = 15;

export function createWarrantyApi(client: HttpClient): Partial<ShopApi> {
  /** One page of a list endpoint, mapped to the domain. */
  async function paged<TDto, T>(
    path: string,
    query: Record<string, QueryValue>,
    map: (dto: TDto) => T,
  ): Promise<Paged<T>> {
    const { data, meta } = await client.get<TDto[]>(path, { query });
    return {
      rows: (data ?? []).map(map),
      total: Number(meta?.total ?? data?.length ?? 0),
      page: Number(meta?.current_page ?? query.page ?? 1),
      perPage: Number(meta?.per_page ?? PER_PAGE),
      lastPage: Number(meta?.last_page ?? 1),
    };
  }

  return {
    async getSaleWarranties(query = {}) {
      return paged<SaleWarrantyDto, ReturnType<typeof toSaleWarranty>>(
        "/sale-warranties",
        {
          page: query.page ?? 1,
          "filter[coverage]": query.coverage,
          sort: query.sort ?? "-created_at",
        },
        toSaleWarranty,
      );
    },

    async getSaleWarranty(id) {
      const { data } = await client.get<SaleWarrantyDto>(`/sale-warranties/${id}`);
      return toSaleWarranty(data);
    },

    async getSaleWarrantiesForSale(saleId) {
      const { data } = await client.get<SaleWarrantyDto[]>(
        `/sales/${saleId}/warranties`,
      );
      return (data ?? []).map(toSaleWarranty);
    },

    async getSaleWarrantiesForUnit(unitId) {
      const { data } = await client.get<SaleWarrantyDto[]>(
        `/serialized-units/${unitId}/warranties`,
      );
      return (data ?? []).map(toSaleWarranty);
    },

    async fileWarrantyClaim(input) {
      const { data } = await client.post<SaleWarrantyClaimDto>(
        `/sale-warranties/${input.warrantyId}/claims`,
        {
          body: {
            reported_defect: input.reportedDefect,
            handling: input.handling,
            repair_ticket_ulid:
              input.handling === "repair_board" && input.repairTicketId
                ? input.repairTicketId
                : undefined,
          },
        },
      );
      return toSaleWarrantyClaim(data);
    },

    async getWarrantyClaims(query = {}) {
      return paged<SaleWarrantyClaimDto, ReturnType<typeof toSaleWarrantyClaim>>(
        "/sale-warranty-claims",
        {
          page: query.page ?? 1,
          "filter[status]": query.status,
          "filter[resolution]": query.resolution,
          "filter[handling]": query.handling,
        },
        toSaleWarrantyClaim,
      );
    },

    async getWarrantyClaim(id) {
      const { data } = await client.get<SaleWarrantyClaimDto>(
        `/sale-warranty-claims/${id}`,
      );
      return toSaleWarrantyClaim(data);
    },

    async resolveWarrantyClaim(input) {
      const { data } = await client.post<SaleWarrantyClaimDto>(
        `/sale-warranty-claims/${input.claimId}/resolve`,
        {
          body: {
            resolution: input.resolution,
            outcome_notes: input.outcomeNotes || undefined,
          },
        },
      );
      return toSaleWarrantyClaim(data);
    },

    async getSupplierReturns(query = {}) {
      return paged<SupplierReturnDto, ReturnType<typeof toSupplierReturn>>(
        "/supplier-returns",
        {
          page: query.page ?? 1,
          "filter[status]": query.status,
          "filter[reason]": query.reason,
          sort: query.sort ?? "-created_at",
        },
        toSupplierReturn,
      );
    },

    async getSupplierReturn(id) {
      const { data } = await client.get<SupplierReturnDto>(
        `/supplier-returns/${id}`,
      );
      return toSupplierReturn(data);
    },

    async createSupplierReturn(input) {
      const { data } = await client.post<SupplierReturnDto>("/supplier-returns", {
        body: {
          serialized_unit_ulid: input.serializedUnitId,
          supplier_ulid: input.supplierId,
          reason: input.reason,
          reason_note: input.reasonNote || undefined,
          sale_warranty_claim_ulid: input.saleWarrantyClaimId || undefined,
        },
      });
      return toSupplierReturn(data);
    },

    async closeSupplierReturn(input) {
      const { data } = await client.post<SupplierReturnDto>(
        `/supplier-returns/${input.returnId}/close`,
        {
          body: {
            outcome: input.outcome,
            outcome_notes: input.outcomeNotes || undefined,
            replacement:
              input.outcome === "replaced" && input.replacement
                ? {
                    imei: input.replacement.imei || undefined,
                    serial_number: input.replacement.serialNumber || undefined,
                    condition: input.replacement.condition || undefined,
                    acquisition_cost: input.replacement.acquisitionCost,
                  }
                : undefined,
            credit_amount:
              input.outcome === "credited" ? input.creditAmount : undefined,
          },
        },
      );
      return toSupplierReturn(data);
    },
  };
}
