"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  Download,
  HandCoins,
  Table2,
  TrendingUp,
  TriangleAlert,
  Undo2,
  Wallet,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, PanelTitle, PanelScroller } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableNumeric,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useReport, useShop } from "@/lib/shop/store";
import { STAGE_META, stageOf } from "@/lib/stages";
import { count, formatDate, formatDateTime, peso, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgingBucket } from "@/lib/shop/contract";

/**
 * Every figure on this screen is computed by the server, in SQL, over the
 * whole branch scope — see `lib/api/live-reports.ts`.
 *
 * Deliberately *not* derived from `db`: the browser cache holds only what has
 * been fetched and is capped per list, so a cache-derived total silently goes
 * wrong once the shop outgrows it. A report that fails loudly is worth more
 * than one that quietly under-counts.
 *
 * Five reports behind tabs — the active one rides in `?tab=` so a nav click,
 * a deep link, and "back" all land right. Only the visible tab fetches.
 */

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const TABS = ["overview", "repair-pnl", "cash", "refunds", "receivables"] as const;
type TabKey = (typeof TABS)[number];

/** Identity is fixed per entity, never reassigned by rank. */
const SERIES = [
  { key: "repair", label: "Repairs", token: "var(--series-repair)" },
  { key: "handset", label: "Handsets", token: "var(--series-handset)" },
  { key: "accessory", label: "Accessories", token: "var(--series-accessory)" },
] as const;

/* ── CSV ─────────────────────────────────────────────────────────────── */

function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ── Screen ──────────────────────────────────────────────────────────── */

export function ReportsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useShop();

  const [range, setRange] = useState<RangeKey>("30");
  const days = RANGES.find((r) => r.key === range)!.days;

  const setTab = useCallback(
    (next: string) => {
      const query = new URLSearchParams(params);
      query.set("tab", next);
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  /* Repair P&L exposes labour and parts margin, so it needs the same clearance
     the margin figures do — `reports.view` plus `reports.margin.view`. */
  const canPnl = can("margin.view");

  const raw = params.get("tab");
  const wanted: TabKey = (TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabKey)
    : "overview";
  /* A deep link to the P&L tab without the clearance falls back to overview
     rather than an empty pane. */
  const tab: TabKey = wanted === "repair-pnl" && !canPnl ? "overview" : wanted;

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Office"
        title="Reports"
        description="Sales and margin, the repair P&L, the drawer, the leakage, and the money still owed."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp aria-hidden /> Sales &amp; margin
          </TabsTrigger>
          {canPnl ? (
            <TabsTrigger value="repair-pnl">
              <Wrench aria-hidden /> Repair P&amp;L
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="cash">
            <Wallet aria-hidden /> Cash reconciliation
          </TabsTrigger>
          <TabsTrigger value="refunds">
            <Undo2 aria-hidden /> Refunds &amp; voids
          </TabsTrigger>
          <TabsTrigger value="receivables">
            <HandCoins aria-hidden /> Receivables
          </TabsTrigger>
        </TabsList>

        {/* One filter row, scoping the range-based tabs below it. */}
        <div className="flex flex-wrap items-center gap-2 pt-4">
          {tab === "receivables" ? (
            <p className="text-xs text-ink-soft">
              A snapshot as of now — no date window.
            </p>
          ) : (
            <div className="flex gap-1" role="group" aria-label="Date range">
              {RANGES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  aria-pressed={range === option.key}
                  className={cn(
                    "tap rounded-md border px-3 text-xs font-medium transition-colors",
                    range === option.key
                      ? "border-bench bg-bench-fill text-bench-ink"
                      : "border-rule bg-copy text-ink-soft hover:bg-secondary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <TabsContent value="overview" className="space-y-4 pt-4 sm:space-y-5">
          <OverviewTab days={days} rangeKey={range} />
        </TabsContent>

        {canPnl ? (
          <TabsContent value="repair-pnl" className="pt-4">
            <RepairPnlTab days={days} rangeKey={range} />
          </TabsContent>
        ) : null}

        <TabsContent value="cash" className="pt-4">
          <CashTab days={days} rangeKey={range} />
        </TabsContent>

        <TabsContent value="refunds" className="pt-4">
          <RefundsTab days={days} rangeKey={range} />
        </TabsContent>

        <TabsContent value="receivables" className="pt-4">
          <ReceivablesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Sales & margin (the original overview) ──────────────────────────── */

function OverviewTab({ days, rangeKey }: { days: number; rangeKey: RangeKey }) {
  const [showTable, setShowTable] = useState(false);

  const sales = useReport((reports) => reports.getSalesReport({ days }), [days]);
  const margin = useReport((reports) => reports.getMarginReport({ days }), [days]);
  const valuation = useReport((reports) => reports.getInventoryValuation());
  const unclaimed = useReport((reports) => reports.getUnclaimedAging());

  const trend = sales.data?.byDay ?? [];
  const totals = sales.data?.totals;
  const grossSales = sales.data?.grossSales ?? 0;

  const exportSales = () =>
    downloadCsv(
      `sales-${rangeKey}d.csv`,
      trend.map((row) => ({
        date: row.date,
        repairs: row.repair.toFixed(2),
        handsets: row.handset.toFixed(2),
        accessories: row.accessory.toFixed(2),
        total: row.grossSales.toFixed(2),
      })),
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
          <Table2 aria-hidden /> {showTable ? "Hide" : "Show"} table
        </Button>
        <Button variant="outline" size="sm" onClick={exportSales} disabled={!trend.length}>
          <Download aria-hidden /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Gross sales"
          value={peso(grossSales, { whole: true })}
          hint={
            sales.data
              ? `${count(sales.data.saleCount)} sale${sales.data.saleCount === 1 ? "" : "s"}`
              : undefined
          }
          state={sales}
        />
        <StatTile
          label="Gross margin"
          value={peso(margin.data?.grossMargin ?? 0, { whole: true })}
          hint={
            margin.data && margin.data.revenue > 0
              ? `${Math.round((margin.data.grossMargin / margin.data.revenue) * 100)}% of revenue`
              : "No revenue in this range"
          }
          state={margin}
        />
        <StatTile
          label="VAT collected"
          value={peso(sales.data?.vatTotal ?? 0, { whole: true })}
          hint={
            sales.data
              ? `${peso(sales.data.discountTotal, { whole: true })} discounted`
              : undefined
          }
          state={sales}
        />
        <StatTile
          label="Stock at cost"
          value={peso(valuation.data?.totalCostValue ?? 0, { whole: true })}
          hint={valuation.data ? `${count(valuation.data.skuCount)} SKUs` : undefined}
          state={valuation}
        />
      </div>

      <Panel>
        <PanelHeader>
          <TrendingUp className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Sales by line</PanelTitle>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {SERIES.map((series) => (
              <span key={series.key} className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span
                  className="h-0.5 w-3 rounded-sm"
                  style={{ background: series.token }}
                  aria-hidden
                />
                {series.label}
              </span>
            ))}
          </div>
        </PanelHeader>

        <PanelBody>
          {sales.error ? (
            <ErrorState error={sales.error} onRetry={sales.refetch} />
          ) : sales.loading ? (
            <Skeleton className="h-64 w-full" />
          ) : grossSales === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No sales in this range."
              body="Widen the date range, or ring up a sale at the counter."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.slice(5)}
                    tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--rule)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(value: number) =>
                      value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                    }
                    tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
                    content={<TrendTooltip />}
                  />
                  {SERIES.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.token}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--copy)" }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelBody>

        {showTable && trend.length ? (
          <PanelScroller className="border-t border-rule">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Repairs</TableHead>
                  <TableHead className="text-right">Handsets</TableHead>
                  <TableHead className="text-right">Accessories</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trend
                  .filter((row) => row.grossSales > 0)
                  .map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="mono text-xs">{row.date}</TableCell>
                      <TableNumeric>{peso(row.repair)}</TableNumeric>
                      <TableNumeric>{peso(row.handset)}</TableNumeric>
                      <TableNumeric>{peso(row.accessory)}</TableNumeric>
                      <TableNumeric className="font-semibold">
                        {peso(row.grossSales)}
                      </TableNumeric>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </PanelScroller>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Sales by line, this range</PanelTitle>
        </PanelHeader>
        {sales.error ? (
          <PanelBody>
            <ErrorState error={sales.error} onRetry={sales.refetch} />
          </PanelBody>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ background: series.token }}
                  aria-hidden
                />
                <span className="flex-1 text-sm text-ink">{series.label}</span>
                <span className="mono text-sm font-medium text-ink">
                  {sales.loading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    peso(totals?.[series.key] ?? 0, { whole: true })
                  )}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 border-t border-rule px-3 py-2.5 sm:px-4">
              <span className="flex-1 text-sm font-semibold text-ink">Gross sales</span>
              <span className="mono text-sm font-semibold text-ink">
                {sales.loading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  peso(grossSales, { whole: true })
                )}
              </span>
            </li>
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Inventory valuation</PanelTitle>
          {valuation.data ? (
            <span className="mono ml-auto text-xs text-ink-faint">
              {count(valuation.data.skuCount)} SKUs
            </span>
          ) : null}
        </PanelHeader>

        {valuation.error ? (
          <PanelBody>
            <ErrorState error={valuation.error} onRetry={valuation.refetch} />
          </PanelBody>
        ) : valuation.loading ? (
          <LoadingRows rows={4} />
        ) : !valuation.data?.rows.length ? (
          <EmptyState
            icon={Table2}
            title="Nothing in stock to value."
            body="Receive stock against a product and it will be valued here."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">At cost</TableHead>
                  <TableHead className="text-right">At retail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuation.data.rows.slice(0, 50).map((row) => (
                  <TableRow key={row.product}>
                    <TableCell className="truncate">{row.product}</TableCell>
                    <TableNumeric>{count(row.onHand)}</TableNumeric>
                    <TableNumeric>{peso(row.costValue)}</TableNumeric>
                    <TableNumeric>{peso(row.retailValue)}</TableNumeric>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell />
                  <TableNumeric className="font-semibold">
                    {peso(valuation.data.totalCostValue)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold">
                    {peso(valuation.data.totalRetailValue)}
                  </TableNumeric>
                </TableRow>
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <TriangleAlert className="size-3.5 text-flag-ink" aria-hidden />
          <PanelTitle>Aging and unclaimed units</PanelTitle>
          {unclaimed.data ? (
            <span className="mono ml-auto text-xs text-ink-faint">
              {unclaimed.data.length} unit{unclaimed.data.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </PanelHeader>

        {unclaimed.error ? (
          <PanelBody>
            <ErrorState error={unclaimed.error} onRetry={unclaimed.refetch} />
          </PanelBody>
        ) : unclaimed.loading ? (
          <LoadingRows rows={4} />
        ) : !unclaimed.data?.length ? (
          <EmptyState
            icon={TriangleAlert}
            title="Nothing is sitting too long."
            body="Units waiting past the shop's unclaimed window will appear here."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Waiting</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unclaimed.data.slice(0, 25).map((row) => (
                  <TableRow key={row.ticketId || row.ticketNo}>
                    <TableCell className="mono text-xs font-semibold">
                      {row.ticketNo}
                    </TableCell>
                    <TableCell className="truncate">{row.customerName}</TableCell>
                    <TableCell className="truncate text-ink-soft">
                      {row.device || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="flag">
                        {STAGE_META[stageOf(row.status)].label}
                      </Badge>
                    </TableCell>
                    <TableNumeric className="font-semibold text-flag-ink">
                      {row.daysUnclaimed}d
                    </TableNumeric>
                    <TableNumeric>
                      {row.balance > 0 ? peso(row.balance) : "—"}
                    </TableNumeric>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>
    </div>
  );
}

/* ── Repair P&L ──────────────────────────────────────────────────────── */

function RepairPnlTab({ days, rangeKey }: { days: number; rangeKey: RangeKey }) {
  const pnl = useReport((reports) => reports.getRepairPnl({ days }), [days]);
  const d = pnl.data;
  const outstanding = d ? Math.max(0, d.totalRevenue - d.paymentsCollected) : 0;

  const exportRows = () =>
    downloadCsv(
      `repair-pnl-${rangeKey}d.csv`,
      (d?.byTechnician ?? []).map((row) => ({
        technician: row.technician,
        total_revenue: row.totalRevenue.toFixed(2),
        labor_revenue: row.laborRevenue.toFixed(2),
        parts_revenue: row.partsRevenue.toFixed(2),
        parts_cost: row.partsCost.toFixed(2),
        gross_margin: row.grossMargin.toFixed(2),
        gross_margin_pct: (row.grossMarginPct * 100).toFixed(1),
        collected: row.paymentsCollected.toFixed(2),
      })),
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReportNote generatedAt={d?.generatedAt}>
        Repair revenue is recognised at release. Repair-ticket payments never
        become sales, so this is the only place labour and parts show up as
        margin. Last {days} days.
      </ReportNote>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Repair revenue"
          value={peso(d?.totalRevenue ?? 0, { whole: true })}
          hint={
            d
              ? `${peso(d.laborRevenue, { whole: true })} labour · ${peso(d.partsRevenue, { whole: true })} parts`
              : undefined
          }
          state={pnl}
        />
        <StatTile
          label="Gross margin"
          value={peso(d?.grossMargin ?? 0, { whole: true })}
          hint={d ? `${percent(d.grossMarginPct)} of revenue` : undefined}
          state={pnl}
        />
        <StatTile
          label="Parts cost"
          value={peso(d?.partsCost ?? 0, { whole: true })}
          hint={d ? `${peso(d.partsMargin, { whole: true })} parts margin` : undefined}
          state={pnl}
        />
        <StatTile
          label="Collected"
          value={peso(d?.paymentsCollected ?? 0, { whole: true })}
          hint={
            d
              ? outstanding > 0
                ? `${peso(outstanding, { whole: true })} earned, not yet collected`
                : "Fully collected"
              : undefined
          }
          state={pnl}
        />
      </div>

      <Panel>
        <PanelHeader>
          <Wrench className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>By technician</PanelTitle>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={exportRows}
            disabled={!d?.byTechnician.length}
          >
            <Download aria-hidden /> CSV
          </Button>
        </PanelHeader>

        {pnl.error ? (
          <PanelBody>
            <ErrorState error={pnl.error} onRetry={pnl.refetch} />
          </PanelBody>
        ) : pnl.loading ? (
          <LoadingRows rows={4} />
        ) : !d?.byTechnician.length ? (
          <EmptyState
            icon={Wrench}
            title="No repairs released in this range."
            body="Widen the range, or release a completed job at the counter."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Labour</TableHead>
                  <TableHead className="text-right">Parts</TableHead>
                  <TableHead className="text-right">Parts cost</TableHead>
                  <TableHead className="text-right">Gross margin</TableHead>
                  <TableHead className="text-right">GM %</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.byTechnician.map((row) => (
                  <TableRow key={row.technician}>
                    <TableCell className="truncate">{row.technician}</TableCell>
                    <TableNumeric className="font-medium">
                      {peso(row.totalRevenue)}
                    </TableNumeric>
                    <TableNumeric>{peso(row.laborRevenue)}</TableNumeric>
                    <TableNumeric>{peso(row.partsRevenue)}</TableNumeric>
                    <TableNumeric className="text-ink-soft">
                      {peso(row.partsCost)}
                    </TableNumeric>
                    <TableNumeric className="font-medium">
                      {peso(row.grossMargin)}
                    </TableNumeric>
                    <TableNumeric className="text-ink-soft">
                      {percent(row.grossMarginPct)}
                    </TableNumeric>
                    <TableNumeric>{peso(row.paymentsCollected)}</TableNumeric>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">All technicians</TableCell>
                  <TableNumeric className="font-semibold">
                    {peso(d.totalRevenue)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold">
                    {peso(d.laborRevenue)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold">
                    {peso(d.partsRevenue)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold text-ink-soft">
                    {peso(d.partsCost)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold">
                    {peso(d.grossMargin)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold text-ink-soft">
                    {percent(d.grossMarginPct)}
                  </TableNumeric>
                  <TableNumeric className="font-semibold">
                    {peso(d.paymentsCollected)}
                  </TableNumeric>
                </TableRow>
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>
    </div>
  );
}

/* ── Cash reconciliation / Z-report ──────────────────────────────────── */

const TENDER_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank_transfer: "Bank transfer",
  store_credit: "Store credit",
  trade_in: "Trade-in",
};
const TENDER_ORDER = [
  "cash",
  "gcash",
  "maya",
  "card",
  "bank_transfer",
  "store_credit",
  "trade_in",
];
/** These settle a sale but never move drawer cash. */
const NON_DRAWER = new Set(["store_credit", "trade_in"]);

function tenderLabel(key: string): string {
  return (
    TENDER_LABEL[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function orderedTenders(map: Record<string, number>): string[] {
  const keys = new Set([...TENDER_ORDER, ...Object.keys(map)]);
  return [...keys].sort(
    (a, b) =>
      (TENDER_ORDER.indexOf(a) + 1 || 99) - (TENDER_ORDER.indexOf(b) + 1 || 99),
  );
}

function varianceLabel(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.005) return "Balanced";
  return value < 0
    ? `Short ${peso(Math.abs(value))}`
    : `Over ${peso(value)}`;
}

function varianceTone(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return "text-ink-soft";
  return value < 0 ? "text-stamp-ink" : "text-flag-ink";
}

function CashTab({ days, rangeKey }: { days: number; rangeKey: RangeKey }) {
  const cash = useReport((reports) => reports.getCashReconciliation({ days }), [days]);
  const d = cash.data;

  const showBranch = useMemo(() => {
    const set = new Set((d?.shifts ?? []).map((s) => s.branch).filter(Boolean));
    return set.size > 1;
  }, [d]);

  const exportRows = () =>
    downloadCsv(
      `cash-reconciliation-${rangeKey}d.csv`,
      (d?.shifts ?? []).map((row) => ({
        shift: row.shiftNo,
        branch: row.branch,
        cashier: row.cashier,
        opened_at: row.openedAt,
        status: row.open ? "open" : "closed",
        opening_float: row.openingFloat.toFixed(2),
        cash_sales: row.cashPayments.toFixed(2),
        cash_in: row.cashIn.toFixed(2),
        cash_out: row.cashOut.toFixed(2),
        expected_cash: row.expectedCash.toFixed(2),
        counted_cash: row.countedCash === null ? "" : row.countedCash.toFixed(2),
        variance: row.variance === null ? "" : row.variance.toFixed(2),
      })),
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReportNote generatedAt={d?.generatedAt}>
        One row per shift opened in the last {days} days, closed against the same{" "}
        <span className="mono">expected_cash</span> formula the close-out uses.
        Open shifts show a live expected total.
      </ReportNote>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Expected cash"
          value={peso(d?.expectedTotal ?? 0, { whole: true })}
          hint={d ? `${count(d.shifts.length)} shift${d.shifts.length === 1 ? "" : "s"}` : undefined}
          state={cash}
        />
        <StatTile
          label="Counted cash"
          value={peso(d?.countedTotal ?? 0, { whole: true })}
          hint={
            d && d.openShiftCount > 0
              ? `${count(d.openShiftCount)} still open`
              : d
                ? "All shifts closed"
                : undefined
          }
          state={cash}
        />
        <StatTile
          label="Variance"
          value={d ? varianceLabel(d.varianceTotal) : "—"}
          valueClassName={d ? varianceTone(d.varianceTotal) : undefined}
          hint={d ? "Counted minus expected, closed shifts" : undefined}
          state={cash}
        />
        <StatTile
          label="Cash sales"
          value={peso(d?.tenderTotals.cash ?? 0, { whole: true })}
          hint={d ? "Drawer takings this range" : undefined}
          state={cash}
        />
      </div>

      <Panel>
        <PanelHeader>
          <Wallet className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Tender totals</PanelTitle>
        </PanelHeader>
        {cash.error ? (
          <PanelBody>
            <ErrorState error={cash.error} onRetry={cash.refetch} />
          </PanelBody>
        ) : cash.loading ? (
          <LoadingRows rows={4} />
        ) : (
          <ul className="divide-y divide-rule-soft">
            {orderedTenders(d?.tenderTotals ?? {}).map((key) => (
              <li key={key} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className="flex-1 text-sm text-ink">{tenderLabel(key)}</span>
                {NON_DRAWER.has(key) ? (
                  <span className="text-xs text-ink-faint">not in drawer</span>
                ) : null}
                <span className="mono text-sm font-medium text-ink">
                  {peso(d?.tenderTotals[key] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Shifts</PanelTitle>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={exportRows}
            disabled={!d?.shifts.length}
          >
            <Download aria-hidden /> CSV
          </Button>
        </PanelHeader>

        {cash.error ? (
          <PanelBody>
            <ErrorState error={cash.error} onRetry={cash.refetch} />
          </PanelBody>
        ) : cash.loading ? (
          <LoadingRows rows={4} />
        ) : !d?.shifts.length ? (
          <EmptyState
            icon={Wallet}
            title="No shifts opened in this range."
            body="Open the drawer at the counter and the shift's close-out will land here."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  {showBranch ? <TableHead>Branch</TableHead> : null}
                  <TableHead>Cashier</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Float</TableHead>
                  <TableHead className="text-right">Cash sales</TableHead>
                  <TableHead className="text-right">Cash in/out</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.shifts.map((row) => (
                  <TableRow key={row.shiftId || row.shiftNo}>
                    <TableCell className="mono text-xs font-semibold">
                      {row.shiftNo || "—"}
                      {row.open ? (
                        <Badge variant="bench" className="ml-1.5 align-middle">
                          open
                        </Badge>
                      ) : null}
                    </TableCell>
                    {showBranch ? (
                      <TableCell className="text-ink-soft">{row.branch || "—"}</TableCell>
                    ) : null}
                    <TableCell className="truncate">{row.cashier}</TableCell>
                    <TableCell className="mono text-xs text-ink-soft">
                      {row.openedAt ? formatDate(row.openedAt) : "—"}
                    </TableCell>
                    <TableNumeric>{peso(row.openingFloat)}</TableNumeric>
                    <TableNumeric>{peso(row.cashPayments)}</TableNumeric>
                    <TableNumeric className="text-ink-soft">
                      {peso(row.cashIn - row.cashOut)}
                    </TableNumeric>
                    <TableNumeric className="font-medium">
                      {peso(row.expectedCash)}
                    </TableNumeric>
                    <TableNumeric>
                      {row.countedCash === null ? "—" : peso(row.countedCash)}
                    </TableNumeric>
                    <TableNumeric className={cn("font-medium", varianceTone(row.variance))}>
                      {row.variance === null ? "—" : varianceLabel(row.variance)}
                    </TableNumeric>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>
    </div>
  );
}

/* ── Refunds & voids ─────────────────────────────────────────────────── */

function RefundsTab({ days, rangeKey }: { days: number; rangeKey: RangeKey }) {
  const rv = useReport((reports) => reports.getRefundsVoids({ days }), [days]);
  const d = rv.data;

  const exportRefunds = () =>
    downloadCsv(
      `refunds-${rangeKey}d.csv`,
      (d?.refunds ?? []).map((row) => ({
        sale: row.saleNo,
        date: row.at,
        method: row.method,
        reason: row.reason,
        processor: row.processor,
        amount: row.amount.toFixed(2),
      })),
    );
  const exportVoids = () =>
    downloadCsv(
      `voids-${rangeKey}d.csv`,
      (d?.voids ?? []).map((row) => ({
        sale: row.saleNo,
        date: row.at,
        void_reason: row.voidReason,
        processor: row.processor,
        amount: row.amount.toFixed(2),
      })),
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReportNote generatedAt={d?.generatedAt}>
        The leakage the sales report hides — it filters voided sales out. Refunds
        are dated when they were processed; voids take the sale's last-touched
        time. Last {days} days.
      </ReportNote>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Refunds"
          value={peso(d?.refundTotal ?? 0, { whole: true })}
          hint={d ? `${count(d.refundCount)} refund${d.refundCount === 1 ? "" : "s"}` : undefined}
          state={rv}
        />
        <StatTile
          label="Voids"
          value={peso(d?.voidTotal ?? 0, { whole: true })}
          hint={d ? `${count(d.voidCount)} sale${d.voidCount === 1 ? "" : "s"} voided` : undefined}
          state={rv}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanel
          title="Refunds by method"
          rows={d?.refundByMethod ?? []}
          loading={rv.loading}
          error={rv.error}
          onRetry={rv.refetch}
          keyLabel={tenderLabel}
        />
        <BreakdownPanel
          title="Refunds by reason"
          rows={d?.refundByReason ?? []}
          loading={rv.loading}
          error={rv.error}
          onRetry={rv.refetch}
          keyLabel={humanize}
        />
      </div>

      <Panel>
        <PanelHeader>
          <Undo2 className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Refunds</PanelTitle>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={exportRefunds}
            disabled={!d?.refunds.length}
          >
            <Download aria-hidden /> CSV
          </Button>
        </PanelHeader>
        {rv.error ? (
          <PanelBody>
            <ErrorState error={rv.error} onRetry={rv.refetch} />
          </PanelBody>
        ) : rv.loading ? (
          <LoadingRows rows={4} />
        ) : !d?.refunds.length ? (
          <EmptyState
            icon={Undo2}
            title="No refunds in this range."
            body="Money handed back at the counter shows up here."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Processed by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.refunds.map((row) => (
                  <TableRow key={row.id || `${row.saleNo}-${row.at}`}>
                    <TableCell className="mono text-xs font-semibold">
                      {row.saleNo || "—"}
                    </TableCell>
                    <TableCell className="mono text-xs text-ink-soft">
                      {row.at ? formatDate(row.at) : "—"}
                    </TableCell>
                    <TableCell>{tenderLabel(row.method)}</TableCell>
                    <TableCell className="truncate text-ink-soft">
                      {humanize(row.reason)}
                    </TableCell>
                    <TableCell className="truncate text-ink-soft">{row.processor}</TableCell>
                    <TableNumeric className="font-medium">{peso(row.amount)}</TableNumeric>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>

      <Panel>
        <PanelHeader>
          <TriangleAlert className="size-3.5 text-stamp-ink" aria-hidden />
          <PanelTitle>Voided sales</PanelTitle>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={exportVoids}
            disabled={!d?.voids.length}
          >
            <Download aria-hidden /> CSV
          </Button>
        </PanelHeader>
        {rv.error ? (
          <PanelBody>
            <ErrorState error={rv.error} onRetry={rv.refetch} />
          </PanelBody>
        ) : rv.loading ? (
          <LoadingRows rows={4} />
        ) : !d?.voids.length ? (
          <EmptyState
            icon={TriangleAlert}
            title="No sales voided in this range."
            body="A sale cancelled after the fact — with its reason — lands here."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Void reason</TableHead>
                  <TableHead>Voided by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.voids.map((row) => (
                  <TableRow key={row.id || `${row.saleNo}-${row.at}`}>
                    <TableCell className="mono text-xs font-semibold">
                      {row.saleNo || "—"}
                    </TableCell>
                    <TableCell className="mono text-xs text-ink-soft">
                      {row.at ? formatDate(row.at) : "—"}
                    </TableCell>
                    <TableCell className="truncate text-ink-soft">
                      {humanize(row.voidReason)}
                    </TableCell>
                    <TableCell className="truncate text-ink-soft">{row.processor}</TableCell>
                    <TableNumeric className="font-medium">{peso(row.amount)}</TableNumeric>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>
    </div>
  );
}

/* ── Receivables aging ───────────────────────────────────────────────── */

const BUCKET_TONE: Record<AgingBucket, string> = {
  "0-30": "bg-rule",
  "31-60": "bg-flag",
  "61-90": "bg-flag",
  "90+": "bg-stamp",
};
const BUCKET_LABEL: Record<AgingBucket, string> = {
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "Over 90 days",
};
const BASIS_LABEL: Record<string, string> = {
  release: "since release",
  promised_date: "since promised",
  promised: "since promised",
  intake: "since intake",
  created: "since intake",
};

function ReceivablesTab() {
  const rec = useReport((reports) => reports.getReceivablesAging());
  const d = rec.data;

  const exportRows = () =>
    downloadCsv(
      "receivables-aging.csv",
      (d?.rows ?? []).map((row) => ({
        ticket: row.ticketNo,
        customer: row.customerName,
        device: row.device,
        branch: row.branch,
        bucket: row.bucket,
        aging_basis: row.agingBasis,
        days_outstanding: String(row.daysOutstanding),
        balance: row.balance.toFixed(2),
      })),
    );

  return (
    <div className="space-y-4 sm:space-y-5">
      <ReportNote generatedAt={d?.generatedAt}>
        Every repair ticket still owing money. The clock starts at release, or
        the promised date, or intake — whichever the ticket has, noted per row.
      </ReportNote>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total outstanding"
          value={peso(d?.totalOutstanding ?? 0, { whole: true })}
          hint={d ? `${count(d.rows.length)} ticket${d.rows.length === 1 ? "" : "s"}` : undefined}
          state={rec}
        />
        {(["0-30", "31-60", "61-90", "90+"] as AgingBucket[]).map((bucket) => {
          const cell = d?.buckets.find((b) => b.bucket === bucket);
          return (
            <div
              key={bucket}
              className="relative rounded-sm border border-rule bg-copy p-3 shadow-panel sm:p-4"
            >
              <span
                className={cn(
                  "absolute inset-y-2 left-0 w-1 rounded-sm",
                  BUCKET_TONE[bucket],
                )}
                aria-hidden
              />
              <p className="label-pad pl-2">{BUCKET_LABEL[bucket]}</p>
              {rec.loading ? (
                <Skeleton className="mt-1.5 ml-2 h-7 w-24" />
              ) : (
                <p className="figure mt-1.5 pl-2 text-xl">
                  {peso(cell?.amount ?? 0, { whole: true })}
                </p>
              )}
              <p className="mt-1 pl-2 text-xs text-ink-soft">
                {rec.loading ? "" : `${count(cell?.count ?? 0)} ticket${(cell?.count ?? 0) === 1 ? "" : "s"}`}
              </p>
            </div>
          );
        })}
      </div>

      <Panel>
        <PanelHeader>
          <Clock className="size-3.5 text-ink-faint" aria-hidden />
          <PanelTitle>Tickets owing money</PanelTitle>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={exportRows}
            disabled={!d?.rows.length}
          >
            <Download aria-hidden /> CSV
          </Button>
        </PanelHeader>

        {rec.error ? (
          <PanelBody>
            <ErrorState error={rec.error} onRetry={rec.refetch} />
          </PanelBody>
        ) : rec.loading ? (
          <LoadingRows rows={5} />
        ) : !d?.rows.length ? (
          <EmptyState
            icon={HandCoins}
            title="Nothing outstanding."
            body="Every released ticket has been paid in full."
          />
        ) : (
          <PanelScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.rows.map((row) => (
                  <TableRow key={row.ticketId || row.ticketNo}>
                    <TableCell className="mono text-xs font-semibold">
                      {row.ticketNo}
                    </TableCell>
                    <TableCell className="truncate">{row.customerName}</TableCell>
                    <TableCell className="truncate text-ink-soft">
                      {row.device || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "block h-3.5 w-1 shrink-0 rounded-sm",
                            BUCKET_TONE[row.bucket],
                          )}
                          aria-hidden
                        />
                        <span className="text-xs">{BUCKET_LABEL[row.bucket]}</span>
                      </span>
                    </TableCell>
                    <TableNumeric
                      className={cn(
                        "font-medium",
                        row.bucket === "90+" && "text-stamp-ink",
                        (row.bucket === "31-60" || row.bucket === "61-90") &&
                          "text-flag-ink",
                      )}
                    >
                      {row.daysOutstanding}d
                      {row.agingBasis ? (
                        <span className="mono ml-1 text-[0.625rem] font-normal text-ink-faint">
                          {BASIS_LABEL[row.agingBasis] ?? ""}
                        </span>
                      ) : null}
                    </TableNumeric>
                    <TableNumeric className="font-semibold">
                      {peso(row.balance)}
                    </TableNumeric>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelScroller>
        )}
      </Panel>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────── */

function humanize(value: string): string {
  if (!value || value === "—") return "—";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ReportNote({
  children,
  generatedAt,
}: {
  children: React.ReactNode;
  generatedAt?: string;
}) {
  return (
    <p className="max-w-prose text-xs leading-relaxed text-ink-soft">
      {children}
      {generatedAt ? (
        <>
          {" "}
          <span className="text-ink-faint">
            Generated {formatDateTime(generatedAt)}.
          </span>
        </>
      ) : null}
    </p>
  );
}

interface BreakdownRow {
  key: string;
  amount: number;
  count: number;
}

function BreakdownPanel({
  title,
  rows,
  loading,
  error,
  onRetry,
  keyLabel,
}: {
  title: string;
  rows: BreakdownRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  keyLabel: (key: string) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  const sorted = [...rows].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      {error ? (
        <PanelBody>
          <ErrorState error={error} onRetry={onRetry} />
        </PanelBody>
      ) : loading ? (
        <LoadingRows rows={3} />
      ) : !sorted.length ? (
        <PanelBody>
          <p className="text-sm text-ink-soft">Nothing to break down.</p>
        </PanelBody>
      ) : (
        <ul className="divide-y divide-rule-soft">
          {sorted.map((row) => (
            <li key={row.key} className="px-3 py-2.5 sm:px-4">
              <div className="flex items-baseline gap-3">
                <span className="flex-1 truncate text-sm text-ink">
                  {keyLabel(row.key)}
                </span>
                {row.count ? (
                  <span className="mono text-xs text-ink-faint">
                    {count(row.count)}
                  </span>
                ) : null}
                <span className="mono text-sm font-medium text-ink">
                  {peso(row.amount)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1 rounded-sm bg-rule-strong"
                style={{ width: `${Math.max(4, (Math.abs(row.amount) / max) * 100)}%` }}
                aria-hidden
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StatTile({
  label,
  value,
  hint,
  state,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Loading and failure are shown in the tile, never as a confident zero. */
  state?: { loading: boolean; error: Error | null };
  valueClassName?: string;
}) {
  return (
    <div className="rounded-sm border border-rule bg-copy p-3 shadow-panel sm:p-4">
      <p className="label-pad">{label}</p>
      {state?.loading ? (
        <Skeleton className="mt-1.5 h-8 w-28" />
      ) : state?.error ? (
        <p className="figure mt-1.5 text-2xl text-ink-faint" title={state.error.message}>
          —
        </p>
      ) : (
        <p className={cn("figure mt-1.5 text-2xl", valueClassName)}>{value}</p>
      )}
      {state?.error ? (
        <p className="mt-1 text-xs text-stamp-ink">Could not be loaded.</p>
      ) : hint && !state?.loading ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  label?: string;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
}

function TrendTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);
  return (
    <div className="rounded-md border border-rule bg-copy px-2.5 py-2 text-xs shadow-float">
      <p className="mono mb-1 text-ink-faint">{label ? formatDate(label) : ""}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-sm"
            style={{ background: entry.color }}
            aria-hidden
          />
          <span className="text-ink-soft">{entry.name}</span>
          <span className="mono ml-auto font-medium text-ink">{peso(entry.value ?? 0)}</span>
        </p>
      ))}
      <p className="mt-1 flex items-center gap-2 border-t border-rule-soft pt-1">
        <span className="text-ink-soft">Total</span>
        <span className="mono ml-auto font-semibold text-ink">{peso(total)}</span>
      </p>
    </div>
  );
}
