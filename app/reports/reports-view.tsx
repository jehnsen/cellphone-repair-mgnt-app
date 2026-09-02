"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Table2, TrendingUp, TriangleAlert } from "lucide-react";
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
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useReport } from "@/lib/shop/store";
import { STAGE_META, stageOf } from "@/lib/stages";
import { count, formatDate, peso } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Every figure on this screen is computed by the server, in SQL, over the
 * whole shop — see `lib/api/live-reports.ts`.
 *
 * Deliberately *not* derived from `db`: the browser cache holds only what has
 * been fetched and is capped at 40 pages per list, so a cache-derived total
 * silently goes wrong once the shop outgrows it. A report that fails loudly is
 * worth more than one that quietly under-counts.
 */

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** Identity is fixed per entity, never reassigned by rank. */
const SERIES = [
  { key: "repair", label: "Repairs", token: "var(--series-repair)" },
  { key: "handset", label: "Handsets", token: "var(--series-handset)" },
  { key: "accessory", label: "Accessories", token: "var(--series-accessory)" },
] as const;

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

export function ReportsView() {
  const [range, setRange] = useState<RangeKey>("30");
  const [showTable, setShowTable] = useState(false);

  const days = RANGES.find((r) => r.key === range)!.days;

  /* Three independent reports: each renders as it lands, and one failing
     endpoint leaves the other two on screen. */
  const sales = useReport((reports) => reports.getSalesReport({ days }), [days]);
  const margin = useReport((reports) => reports.getMarginReport({ days }), [days]);
  const valuation = useReport((reports) => reports.getInventoryValuation());
  const unclaimed = useReport((reports) => reports.getUnclaimedAging());

  const trend = sales.data?.byDay ?? [];
  const totals = sales.data?.totals;
  const grossSales = sales.data?.grossSales ?? 0;

  const exportSales = () =>
    downloadCsv(
      `sales-${range}d.csv`,
      trend.map((row) => ({
        date: row.date,
        repairs: row.repair.toFixed(2),
        handsets: row.handset.toFixed(2),
        accessories: row.accessory.toFixed(2),
        total: row.grossSales.toFixed(2),
      })),
    );

  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Office"
        title="Reports"
        description="Sales, margin, valuation, and the units nobody has come back for."
      />

      {/* One filter row, scoping everything below it. */}
      <div className="flex flex-wrap items-center gap-2">
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

        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setShowTable((v) => !v)}
        >
          <Table2 aria-hidden /> {showTable ? "Hide" : "Show"} table
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportSales}
          disabled={!trend.length}
        >
          <Download aria-hidden /> Export CSV
        </Button>
      </div>

      {/* KPI row — headline numbers are tiles, not a bar chart. */}
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
          hint={
            valuation.data ? `${count(valuation.data.skuCount)} SKUs` : undefined
          }
          state={valuation}
        />
      </div>

      {/* Trend: three revenue lines on one axis. */}
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
                  <CartesianGrid
                    stroke="var(--grid)"
                    strokeWidth={1}
                    vertical={false}
                  />
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

      {/* Valuation: three numbers, so tiles rather than a 3-slice pie. */}
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
              <li
                key={series.key}
                className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              >
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

      {/* Inventory valuation, straight off the server's own walk of stock. */}
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

      {/* Aging units: a table, because every row needs acting on. */}
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

/* ── Tiles & tooltips ────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  hint,
  state,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Loading and failure are shown in the tile, never as a confident zero. */
  state?: { loading: boolean; error: Error | null };
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
        <p className="figure mt-1.5 text-2xl">{value}</p>
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
