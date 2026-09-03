"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatImei } from "@/lib/format";
import {
  CLAIM_STATUS_META,
  SUPPLIER_RETURN_STATUS_META,
  WARRANTY_STATUS_META,
  warrantyStatusOf,
} from "@/lib/warranty";
import type {
  ClaimStatus,
  SaleWarranty,
  SupplierReturnStatus,
  WarrantyUnitRef,
} from "@/lib/types";

/**
 * The shared furniture for the three warranty screens: status badges, the
 * one-line unit read, and the Prev/Next pager. Kept together so a badge
 * weight is defined once (`lib/warranty.ts`) and drawn the same everywhere.
 */

export function WarrantyStatusBadge({
  warranty,
}: {
  warranty: Pick<SaleWarranty, "voidedAt" | "isActive">;
}) {
  const meta = WARRANTY_STATUS_META[warrantyStatusOf(warranty)];
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const meta = CLAIM_STATUS_META[status];
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export function SupplierReturnStatusBadge({
  status,
}: {
  status: SupplierReturnStatus;
}) {
  const meta = SUPPLIER_RETURN_STATUS_META[status];
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export function CoverageBadge({ within }: { within: boolean }) {
  return within ? (
    <Badge variant="outline">In coverage</Badge>
  ) : (
    <Badge variant="flag">Out of coverage</Badge>
  );
}

/** The number a unit is read out by: IMEI grouped, else the serial. */
export function unitIdentifier(unit: WarrantyUnitRef | undefined): string {
  if (!unit) return "—";
  if (unit.imei) return formatImei(unit.imei);
  return unit.serialNumber || "—";
}

/** "iPhone 13 · 35 693803 564380 9" for a table cell. */
export function UnitLine({ unit }: { unit: WarrantyUnitRef | undefined }) {
  if (!unit) return <span className="text-ink-faint">—</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-ink">{unit.productName}</span>
      <span className="mono truncate text-xs text-ink-faint">
        {unitIdentifier(unit)}
      </span>
    </span>
  );
}

export function Pager({
  page,
  lastPage,
  total,
  onPage,
}: {
  page: number;
  lastPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (lastPage <= 1) {
    return (
      <span className="mono text-xs text-ink-faint">
        {total} {total === 1 ? "row" : "rows"}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-xs text-ink-faint">
        Page {page} of {lastPage} · {total} rows
      </span>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        onClick={() => onPage(page + 1)}
        disabled={page >= lastPage}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

/** A label/value row for the detail panels. */
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 sm:px-4">
      <span className="label-pad w-32 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-ink">{children}</span>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        <ChevronLeft aria-hidden /> {label}
      </Link>
    </Button>
  );
}
