import { money } from "@/lib/format";
import type {
  SaleWarrantyClaimDto,
  SaleWarrantyDto,
  SerializedUnitDto,
  SupplierReturnDto,
} from "@/lib/api/dto";
import type {
  HandsetCondition,
  SaleWarranty,
  SaleWarrantyClaim,
  SupplierReturn,
  WarrantyUnitRef,
} from "@/lib/types";

/**
 * Wire → domain for the sale-side warranty: the warranty a serialized unit
 * ships with, a customer's claim against it, and a unit sent back to its
 * vendor. The same rule as the other mapper files — this is the one place
 * the server's vocabulary becomes the domain's.
 */

const num = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? money(parsed) : 0;
};

/** `acquisition_cost` / `credit_amount` are dropped by the server for a
 *  caller without `reports.margin.view`; keep the distinction. */
const gatedMoney = (value: number | string | null | undefined): number | undefined =>
  value === null || value === undefined ? undefined : num(value);

const CONDITION: Record<string, HandsetCondition> = {
  brand_new: "brand_new",
  open_box: "open_box",
  secondhand: "secondhand",
  refurbished: "refurbished",
};

const UNIT_STATUS: Record<string, WarrantyUnitRef["status"]> = {
  in_stock: "in_stock",
  reserved: "reserved",
  sold: "sold",
  for_repair: "for_repair",
  returned: "returned",
  /* The domain has no "written off" — a retired unit is out of stock either
     way, and `returned` is the closest non-sellable state the UI draws. */
  written_off: "returned",
  returned_to_supplier: "returned_to_supplier",
};

export function toWarrantyUnitRef(
  dto: SerializedUnitDto | null | undefined,
): WarrantyUnitRef | undefined {
  if (!dto) return undefined;
  return {
    id: dto.ulid,
    imei: dto.imei ?? undefined,
    serialNumber: dto.serial_number ?? undefined,
    condition: CONDITION[dto.condition] ?? "secondhand",
    status: UNIT_STATUS[dto.status] ?? "in_stock",
    productName: dto.product?.name ?? "Unit",
    acquisitionCost: gatedMoney(dto.acquisition_cost),
  };
}

export function toSaleWarranty(dto: SaleWarrantyDto): SaleWarranty {
  return {
    id: dto.ulid,
    warrantyCode: dto.warranty_code,
    coverage: dto.coverage,
    termDays: Number(dto.term_days ?? 0),
    startsAt: dto.starts_at ?? "",
    expiryDate: dto.expiry_date ?? "",
    isActive: Boolean(dto.is_active),
    voidedAt: dto.voided_at ?? undefined,
    terms: dto.terms ?? undefined,
    exclusions: Array.isArray(dto.exclusions)
      ? dto.exclusions
      : dto.exclusions
        ? [dto.exclusions]
        : undefined,
    saleId: dto.sale_ulid ?? undefined,
    unit: toWarrantyUnitRef(dto.serialized_unit),
    customer: dto.customer
      ? { id: dto.customer.ulid, name: dto.customer.name }
      : undefined,
    claims: dto.claims ? dto.claims.map(toSaleWarrantyClaim) : undefined,
    createdAt: dto.created_at ?? new Date().toISOString(),
  };
}

export function toSaleWarrantyClaim(dto: SaleWarrantyClaimDto): SaleWarrantyClaim {
  return {
    id: dto.ulid,
    reportedDefect: dto.reported_defect,
    handling: dto.handling,
    withinCoverage: Boolean(dto.within_coverage),
    status: dto.status,
    resolution: dto.resolution ?? undefined,
    outcomeNotes: dto.outcome_notes ?? undefined,
    repairTicketId: dto.repair_ticket_ulid ?? undefined,
    warranty: dto.warranty ? toSaleWarranty(dto.warranty) : undefined,
    unit: toWarrantyUnitRef(dto.serialized_unit),
    supplierReturnId: dto.supplier_return_ulid ?? undefined,
    filedBy: dto.filed_by
      ? { id: dto.filed_by.ulid, name: dto.filed_by.name }
      : undefined,
    resolvedAt: dto.resolved_at ?? undefined,
    createdAt: dto.created_at ?? new Date().toISOString(),
  };
}

export function toSupplierReturn(dto: SupplierReturnDto): SupplierReturn {
  return {
    id: dto.ulid,
    reason: dto.reason,
    reasonNote: dto.reason_note ?? undefined,
    status: dto.status,
    creditAmount: gatedMoney(dto.credit_amount),
    sentAt: dto.sent_at ?? "",
    resolvedAt: dto.resolved_at ?? undefined,
    saleWarrantyClaimId: dto.sale_warranty_claim_ulid ?? undefined,
    supplier: dto.supplier
      ? { id: dto.supplier.ulid, name: dto.supplier.name }
      : undefined,
    unit: toWarrantyUnitRef(dto.serialized_unit),
    replacementUnit: toWarrantyUnitRef(dto.replacement_serialized_unit),
    createdAt: dto.created_at ?? new Date().toISOString(),
  };
}
