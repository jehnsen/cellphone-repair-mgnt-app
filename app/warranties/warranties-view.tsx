"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageX, ScrollText, ShieldCheck, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelScroller } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useQuery, useShop } from "@/lib/shop/store";
import { formatDate, peso } from "@/lib/format";
import {
  CLAIM_HANDLING_META,
  CLAIM_RESOLUTIONS,
  COVERAGE_LABEL,
  humanizeWarrantyEnum,
  SUPPLIER_RETURN_REASONS,
} from "@/lib/warranty";
import type {
  ClaimListQuery,
  SupplierReturnListQuery,
  WarrantyListQuery,
} from "@/lib/shop/queries";
import {
  ClaimStatusBadge,
  CoverageBadge,
  Pager,
  SupplierReturnStatusBadge,
  UnitLine,
  unitIdentifier,
  WarrantyStatusBadge,
} from "./_components/warranty-ui";
import { SupplierReturnDialog } from "./_components/supplier-return-dialog";

/**
 * The Warranties area: one screen, three lists behind tabs — the warranties
 * serialized units ship with, the claims against them, and the units sent
 * back to a vendor. The active tab rides in `?tab=` so a nav click, a
 * deep link, and "back from a detail page" all land right.
 *
 * Every figure here is server-paginated and never cached in `db` — the same
 * discipline the reports screen keeps.
 */

const TABS = ["sale", "claims", "returns"] as const;
type TabKey = (typeof TABS)[number];

export function WarrantiesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get("tab");
  const tab: TabKey = (TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabKey)
    : "sale";

  const setTab = useCallback(
    (next: string) => {
      const query = new URLSearchParams(params);
      query.set("tab", next);
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Shop"
        title="Warranties"
        description="The shop and manufacturer warranties sold units carry, the claims customers file against them, and units shipped back to a supplier."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sale">
            <ShieldCheck aria-hidden /> Sale warranties
          </TabsTrigger>
          <TabsTrigger value="claims">
            <ScrollText aria-hidden /> Warranty claims
          </TabsTrigger>
          <TabsTrigger value="returns">
            <Undo2 aria-hidden /> Supplier returns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale" className="pt-4">
          <SaleWarrantiesList />
        </TabsContent>
        <TabsContent value="claims" className="pt-4">
          <WarrantyClaimsList />
        </TabsContent>
        <TabsContent value="returns" className="pt-4">
          <SupplierReturnsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── A filter <Select> that treats "" as "no filter" ─────────────────── */

const ANY = "__any__";

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(v) => onChange(v === ANY ? undefined : v)}
    >
      <SelectTrigger size="sm" className="w-auto min-w-[9rem]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label}: any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ── Sale warranties ─────────────────────────────────────────────────── */

function SaleWarrantiesList() {
  const [page, setPage] = useState(1);
  const [coverage, setCoverage] = useState<WarrantyListQuery["coverage"]>();
  const [sort, setSort] = useState<WarrantyListQuery["sort"]>("-created_at");

  const { data, loading, error, refetch } = useQuery(
    (api) => api.getSaleWarranties({ page, coverage, sort }),
    [page, coverage, sort],
  );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Sale warranties</PanelTitle>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <FilterSelect
            label="Coverage"
            value={coverage}
            onChange={(v) => {
              setCoverage(v as WarrantyListQuery["coverage"]);
              setPage(1);
            }}
            options={[
              { value: "shop", label: "Shop" },
              { value: "manufacturer", label: "Manufacturer" },
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(v) => {
              setSort((v as WarrantyListQuery["sort"]) ?? "-created_at");
              setPage(1);
            }}
            options={[
              { value: "-created_at", label: "Newest first" },
              { value: "expiry_date", label: "Expiring soonest" },
            ]}
          />
        </div>
      </PanelHeader>

      {error ? (
        <div className="p-3 sm:p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : loading ? (
        <LoadingRows rows={6} />
      ) : !data?.rows.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="No sale warranties yet."
          body="Selling a phone or laptop issues one only when it has a term: the product's catalog warranty days, or a term the cashier sets on the cart line at checkout. A zero-term sale issues nothing."
        />
      ) : (
        <PanelScroller>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-secondary/60">
                  <TableCell className="mono text-xs font-semibold">
                    <Link
                      href={`/warranties/sale/${row.id}`}
                      className="text-bench-ink hover:underline"
                    >
                      {row.warrantyCode}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[13rem]">
                    <UnitLine unit={row.unit} />
                  </TableCell>
                  <TableCell className="truncate text-ink-soft">
                    {row.customer?.name ?? "Walk-in"}
                  </TableCell>
                  <TableCell className="text-ink-soft">
                    {COVERAGE_LABEL[row.coverage]}
                  </TableCell>
                  <TableCell className="mono text-xs text-ink-soft">
                    {row.expiryDate ? formatDate(row.expiryDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <WarrantyStatusBadge warranty={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelScroller>
      )}

      {data ? (
        <PanelFooter>
          <Pager
            page={data.page}
            lastPage={data.lastPage}
            total={data.total}
            onPage={setPage}
          />
        </PanelFooter>
      ) : null}
    </Panel>
  );
}

/* ── Warranty claims ─────────────────────────────────────────────────── */

function WarrantyClaimsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ClaimListQuery["status"]>();
  const [resolution, setResolution] = useState<ClaimListQuery["resolution"]>();
  const [handling, setHandling] = useState<ClaimListQuery["handling"]>();

  const { data, loading, error, refetch } = useQuery(
    (api) => api.getWarrantyClaims({ page, status, resolution, handling }),
    [page, status, resolution, handling],
  );

  const resetPage = () => setPage(1);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Warranty claims</PanelTitle>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as ClaimListQuery["status"]);
              resetPage();
            }}
            options={[
              { value: "open", label: "Open" },
              { value: "resolved", label: "Resolved" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <FilterSelect
            label="Handling"
            value={handling}
            onChange={(v) => {
              setHandling(v as ClaimListQuery["handling"]);
              resetPage();
            }}
            options={[
              { value: "separate", label: "CP units" },
              { value: "repair_board", label: "Repair board" },
            ]}
          />
          <FilterSelect
            label="Resolution"
            value={resolution}
            onChange={(v) => {
              setResolution(v as ClaimListQuery["resolution"]);
              resetPage();
            }}
            options={CLAIM_RESOLUTIONS.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
          />
        </div>
      </PanelHeader>

      {error ? (
        <div className="p-3 sm:p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : loading ? (
        <LoadingRows rows={6} />
      ) : !data?.rows.length ? (
        <EmptyState
          icon={ScrollText}
          title="No warranty claims."
          body="When a customer brings a unit back, open its warranty on the Sale warranties tab and use File a claim. Claims filed there show up here."
        />
      ) : (
        <PanelScroller>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filed</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Defect</TableHead>
                <TableHead>Handling</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resolution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-secondary/60">
                  <TableCell className="mono whitespace-nowrap text-xs">
                    <Link
                      href={`/warranties/claims/${row.id}`}
                      className="text-bench-ink hover:underline"
                    >
                      {formatDate(row.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    <UnitLine unit={row.unit} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-ink-soft">
                    {row.reportedDefect}
                  </TableCell>
                  <TableCell>
                    <Badge variant={CLAIM_HANDLING_META[row.handling].badge}>
                      {CLAIM_HANDLING_META[row.handling].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CoverageBadge within={row.withinCoverage} />
                  </TableCell>
                  <TableCell>
                    <ClaimStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-ink-soft">
                    {row.resolution
                      ? humanizeWarrantyEnum(row.resolution)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelScroller>
      )}

      {data ? (
        <PanelFooter>
          <Pager
            page={data.page}
            lastPage={data.lastPage}
            total={data.total}
            onPage={setPage}
          />
        </PanelFooter>
      ) : null}
    </Panel>
  );
}

/* ── Supplier returns ────────────────────────────────────────────────── */

function SupplierReturnsList() {
  const router = useRouter();
  const { can } = useShop();
  const showCost = can("margin.view");
  const mayManage = can("supplier_returns.manage");

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SupplierReturnListQuery["status"]>();
  const [reason, setReason] = useState<SupplierReturnListQuery["reason"]>();
  const [creating, setCreating] = useState(false);

  const { data, loading, error, refetch } = useQuery(
    (api) => api.getSupplierReturns({ page, status, reason }),
    [page, status, reason],
  );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Supplier returns</PanelTitle>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as SupplierReturnListQuery["status"]);
              setPage(1);
            }}
            options={[
              { value: "sent", label: "Sent" },
              { value: "replaced", label: "Replaced" },
              { value: "credited", label: "Credited" },
              { value: "rejected", label: "Rejected" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <FilterSelect
            label="Reason"
            value={reason}
            onChange={(v) => {
              setReason(v as SupplierReturnListQuery["reason"]);
              setPage(1);
            }}
            options={SUPPLIER_RETURN_REASONS.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
          />
          {mayManage ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Undo2 aria-hidden /> New return
            </Button>
          ) : null}
        </div>
      </PanelHeader>

      {error ? (
        <div className="p-3 sm:p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : loading ? (
        <LoadingRows rows={6} />
      ) : !data?.rows.length ? (
        <EmptyState
          icon={PackageX}
          title="No supplier returns."
          body={
            mayManage
              ? "Start one with New return, or send a unit back from a warranty claim."
              : "Units shipped back to a vendor for a factory defect will appear here."
          }
        />
      ) : (
        <PanelScroller>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {showCost ? (
                  <TableHead className="text-right">Credit</TableHead>
                ) : null}
                <TableHead>Replacement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-secondary/60">
                  <TableCell className="mono whitespace-nowrap text-xs">
                    <Link
                      href={`/warranties/returns/${row.id}`}
                      className="text-bench-ink hover:underline"
                    >
                      {row.sentAt ? formatDate(row.sentAt) : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    <UnitLine unit={row.unit} />
                  </TableCell>
                  <TableCell className="truncate text-ink-soft">
                    {row.supplier?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-ink-soft">
                    {humanizeWarrantyEnum(row.reason)}
                  </TableCell>
                  <TableCell>
                    <SupplierReturnStatusBadge status={row.status} />
                  </TableCell>
                  {showCost ? (
                    <TableCell className="mono text-right text-ink-soft">
                      {row.creditAmount != null ? peso(row.creditAmount) : "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="mono text-xs text-ink-soft">
                    {row.replacementUnit
                      ? unitIdentifier(row.replacementUnit)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelScroller>
      )}

      {data ? (
        <PanelFooter>
          <Pager
            page={data.page}
            lastPage={data.lastPage}
            total={data.total}
            onPage={setPage}
          />
        </PanelFooter>
      ) : null}

      {creating ? (
        <SupplierReturnDialog
          onClose={() => setCreating(false)}
          onCreated={(created) =>
            router.push(`/warranties/returns/${created.id}`)
          }
        />
      ) : null}
    </Panel>
  );
}
