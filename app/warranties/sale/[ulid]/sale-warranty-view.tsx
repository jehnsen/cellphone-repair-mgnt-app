"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollText, ShieldCheck, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useShop } from "@/lib/shop/store";
import { formatDate, formatDateTime } from "@/lib/format";
import { COVERAGE_LABEL, humanizeWarrantyEnum } from "@/lib/warranty";
import {
  BackLink,
  ClaimStatusBadge,
  CoverageBadge,
  InfoRow,
  unitIdentifier,
  WarrantyStatusBadge,
} from "../../_components/warranty-ui";
import { FileClaimDialog } from "../../_components/file-claim-dialog";

export function SaleWarrantyView({ ulid }: { ulid: string }) {
  const { can, db } = useShop();
  const [filing, setFiling] = useState(false);

  const { data: warranty, loading, error, refetch } = useQuery(
    (api) => api.getSaleWarranty(ulid),
    [ulid],
  );

  const sale = warranty?.saleId
    ? db.sales.find((s) => s.id === warranty.saleId)
    : undefined;

  const voided = Boolean(warranty?.voidedAt);
  const mayFile = can("sales_warranty.manage");

  return (
    <div className="page space-y-4 sm:space-y-5">
      <BackLink href="/warranties?tab=sale" label="Sale warranties" />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading || !warranty ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <PageHeader
            eyebrow="Warranty"
            title={warranty.warrantyCode}
            actions={
              mayFile ? (
                voided ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button disabled>
                          <ScrollText aria-hidden /> File a claim
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      This warranty was voided with its sale and can no longer be
                      claimed.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button onClick={() => setFiling(true)}>
                    <ScrollText aria-hidden /> File a claim
                  </Button>
                )
              ) : undefined
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <WarrantyStatusBadge warranty={warranty} />
            <Badge variant="outline">{COVERAGE_LABEL[warranty.coverage]}</Badge>
            {voided ? (
              <span className="flex items-center gap-1 text-xs text-ink-faint">
                <ShieldX className="size-3.5" aria-hidden />
                voided {formatDateTime(warranty.voidedAt!)}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 sm:gap-5">
            <Panel>
              <PanelHeader>
                <ShieldCheck className="size-3.5 text-ink-faint" aria-hidden />
                <PanelTitle>Warranty</PanelTitle>
              </PanelHeader>
              <div className="divide-y divide-rule-soft">
                <InfoRow label="Coverage">{COVERAGE_LABEL[warranty.coverage]}</InfoRow>
                <InfoRow label="Term">{warranty.termDays} days</InfoRow>
                <InfoRow label="Starts">
                  {warranty.startsAt ? formatDate(warranty.startsAt) : "—"}
                </InfoRow>
                <InfoRow label="Expires">
                  {warranty.expiryDate ? formatDate(warranty.expiryDate) : "—"}
                </InfoRow>
                <InfoRow label="Issued">
                  {formatDateTime(warranty.createdAt)}
                </InfoRow>
                {sale ? (
                  <InfoRow label="Sale">
                    <span className="mono text-xs">{sale.saleNo}</span>
                  </InfoRow>
                ) : null}
              </div>
              {warranty.terms || warranty.exclusions?.length ? (
                <PanelBody className="space-y-2 border-t border-rule-soft text-sm">
                  {warranty.terms ? (
                    <p className="text-ink-soft">{warranty.terms}</p>
                  ) : null}
                  {warranty.exclusions?.length ? (
                    <p className="text-xs text-ink-faint">
                      Not covered: {warranty.exclusions.join("; ")}.
                    </p>
                  ) : null}
                </PanelBody>
              ) : null}
            </Panel>

            <div className="space-y-4 sm:space-y-5">
              <Panel>
                <PanelHeader>
                  <PanelTitle>Unit</PanelTitle>
                </PanelHeader>
                <div className="divide-y divide-rule-soft">
                  <InfoRow label="Product">
                    {warranty.unit?.productName ?? "—"}
                  </InfoRow>
                  <InfoRow label="IMEI / serial">
                    <span className="mono text-xs">
                      {unitIdentifier(warranty.unit)}
                    </span>
                  </InfoRow>
                  <InfoRow label="Condition">
                    {humanizeWarrantyEnum(warranty.unit?.condition)}
                  </InfoRow>
                  <InfoRow label="Unit status">
                    {humanizeWarrantyEnum(warranty.unit?.status)}
                  </InfoRow>
                </div>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Customer</PanelTitle>
                </PanelHeader>
                <PanelBody className="text-sm text-ink">
                  {warranty.customer?.name ?? "Walk-in"}
                </PanelBody>
              </Panel>
            </div>
          </div>

          <Panel>
            <PanelHeader>
              <ScrollText className="size-3.5 text-ink-faint" aria-hidden />
              <PanelTitle>Claims</PanelTitle>
              <span className="mono ml-auto text-xs text-ink-faint">
                {warranty.claims?.length ?? 0}
              </span>
            </PanelHeader>
            {!warranty.claims?.length ? (
              <EmptyState
                icon={ScrollText}
                title="No claims on this warranty."
                body={
                  mayFile && !voided
                    ? "File one when the customer brings the unit back."
                    : "Claims a customer files against this warranty will appear here."
                }
              />
            ) : (
              <ul className="divide-y divide-rule-soft">
                {warranty.claims.map((claim) => (
                  <li key={claim.id}>
                    <Link
                      href={`/warranties/claims/${claim.id}`}
                      className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-secondary sm:px-4"
                    >
                      <span className="mono text-xs text-ink-faint">
                        {formatDate(claim.createdAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                        {claim.reportedDefect}
                      </span>
                      <CoverageBadge within={claim.withinCoverage} />
                      <ClaimStatusBadge status={claim.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {filing && warranty ? (
        <FileClaimDialog
          warrantyId={warranty.id}
          onClose={() => setFiling(false)}
        />
      ) : null}
    </div>
  );
}
