import type {
  ClaimHandling,
  ClaimResolution,
  ClaimStatus,
  SaleWarranty,
  SaleWarrantyCoverage,
  SaleWarrantyStatus,
  SupplierReturnOutcome,
  SupplierReturnReason,
  SupplierReturnStatus,
} from "@/lib/types";

/**
 * The one place the sale-warranty vocabulary becomes something a person
 * reads — labels, and the badge weight each state gets.
 *
 * Colour follows the shop rule: it is spent on *urgency*, not status. Every
 * status badge here stays neutral (`outline` / `tint` / `ghost`); the single
 * hue is `flag` on a claim that is **out of coverage**, and `bench` on a
 * live warranty (the same read Customers already gives an active warranty).
 */

type BadgeVariant = "outline" | "tint" | "ghost" | "bench" | "flag";

interface Meta {
  label: string;
  badge: BadgeVariant;
}

/* ── Sale warranty ───────────────────────────────────────────────────── */

export function warrantyStatusOf(
  warranty: Pick<SaleWarranty, "voidedAt" | "isActive">,
): SaleWarrantyStatus {
  if (warranty.voidedAt) return "voided";
  return warranty.isActive ? "active" : "expired";
}

export const WARRANTY_STATUS_META: Record<SaleWarrantyStatus, Meta> = {
  active: { label: "Active", badge: "bench" },
  expired: { label: "Expired", badge: "outline" },
  voided: { label: "Voided", badge: "ghost" },
};

export const COVERAGE_LABEL: Record<SaleWarrantyCoverage, string> = {
  shop: "Shop warranty",
  manufacturer: "Manufacturer warranty",
};

/* ── Claim ───────────────────────────────────────────────────────────── */

export const CLAIM_STATUS_META: Record<ClaimStatus, Meta> = {
  open: { label: "Open", badge: "outline" },
  resolved: { label: "Resolved", badge: "tint" },
  rejected: { label: "Rejected", badge: "ghost" },
};

export const CLAIM_HANDLING_META: Record<ClaimHandling, Meta> = {
  separate: { label: "CP units", badge: "outline" },
  repair_board: { label: "Repair board", badge: "tint" },
};

/** Drives the resolve dialog's select and every resolution label. */
export const CLAIM_RESOLUTIONS: { value: ClaimResolution; label: string }[] = [
  { value: "repaired_in_house", label: "Repaired in-house" },
  { value: "replaced", label: "Replaced" },
  { value: "returned_to_supplier", label: "Returned to supplier" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected — no fault / not covered" },
];

const CLAIM_RESOLUTION_LABEL = Object.fromEntries(
  CLAIM_RESOLUTIONS.map((row) => [row.value, row.label]),
) as Record<ClaimResolution, string>;

/* ── Supplier return ─────────────────────────────────────────────────── */

export const SUPPLIER_RETURN_STATUS_META: Record<SupplierReturnStatus, Meta> = {
  sent: { label: "Sent", badge: "outline" },
  replaced: { label: "Replaced", badge: "tint" },
  credited: { label: "Credited", badge: "tint" },
  rejected: { label: "Rejected", badge: "ghost" },
  closed: { label: "Closed", badge: "ghost" },
};

export const SUPPLIER_RETURN_REASONS: { value: SupplierReturnReason; label: string }[] = [
  { value: "factory_defect", label: "Factory defect" },
  { value: "dead_on_arrival", label: "Dead on arrival" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "other", label: "Other" },
];

export const SUPPLIER_RETURN_OUTCOMES: { value: SupplierReturnOutcome; label: string }[] = [
  { value: "replaced", label: "Replaced — supplier sent a new unit" },
  { value: "credited", label: "Credited — supplier gave a credit" },
  { value: "rejected", label: "Rejected — supplier refused the return" },
  { value: "closed", label: "Closed — no further action" },
];

/* ── One humaniser for any of the above enum strings ──────────────────── */

const LABELS: Record<string, string> = {
  ...COVERAGE_LABEL,
  ...CLAIM_RESOLUTION_LABEL,
  ...Object.fromEntries(SUPPLIER_RETURN_REASONS.map((r) => [r.value, r.label])),
  separate: "Kept under CP units",
  repair_board: "Attached to a repair job order",
};

/** `factory_defect` → "Factory defect", falling back to a Title-Cased split. */
export function humanizeWarrantyEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    LABELS[value] ??
    value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}
