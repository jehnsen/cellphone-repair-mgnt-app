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
import { EmptyState } from "@/components/ui/states";
import { useShop } from "@/lib/shop/store";
import { itemStock } from "@/lib/shop/queries";
import { STAGE_META, stageOf } from "@/lib/stages";
import { count, formatDate, manilaDayKey, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sale } from "@/lib/types";

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

function saleBucket(sale: Sale): "repair" | "handset" | "accessory" {
  if (sale.lines.some((line) => line.kind === "handset")) return "handset";
  if (sale.lines.some((line) => line.kind === "service")) return "repair";
  return "accessory";
}

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
  const { db } = useShop();
  const [range, setRange] = useState<RangeKey>("30");
  const [showTable, setShowTable] = useState(false);

  const days = RANGES.find((r) => r.key === range)!.days;

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [days]);

  const sales = useMemo(
    () => db.sales.filter((sale) => new Date(sale.soldAt) >= since),
    [db.sales, since],
  );

  const tickets = useMemo(
    () => db.tickets.filter((ticket) => new Date(ticket.createdAt) >= since),
    [db.tickets, since],
  );

  /* One row per day, one column per revenue line. */
  const trend = useMemo(() => {
    const buckets = new Map<
      string,
      { day: string; repair: number; handset: number; accessory: number }
    >();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      buckets.set(manilaDayKey(d), {
        day: manilaDayKey(d),
        repair: 0,
        handset: 0,
        accessory: 0,
      });
    }
    sales.forEach((sale) => {
      const row = buckets.get(manilaDayKey(sale.soldAt));
      if (row) row[saleBucket(sale)] += sale.totalDue;
    });
    return [...buckets.values()];
  }, [sales, since, days]);

  const totals = useMemo(() => {
    const base = { repair: 0, handset: 0, accessory: 0 };
    sales.forEach((sale) => {
      base[saleBucket(sale)] += sale.totalDue;
    });
    return base;
  }, [sales]);

  const grossSales = totals.repair + totals.handset + totals.accessory;

  const margin = useMemo(
    () =>
      sales.reduce(
        (sum, sale) =>
          sum +
          sale.lines.reduce(
            (lineSum, line) => lineSum + (line.unitPrice - line.unitCost) * line.quantity,
            0,
          ),
        0,
      ),
    [sales],
  );

  const valuation = useMemo(() => {
    const byClass = { handset: 0, accessory: 0, spare_part: 0 };
    db.items.forEach((item) => {
      if (item.itemClass === "handset") {
        byClass.handset += (item.units ?? [])
          .filter((unit) => unit.status === "in_stock")
          .reduce((sum, unit) => sum + unit.cost, 0);
      } else {
        byClass[item.itemClass] += itemStock(db, item.id) * item.unitCost;
      }
    });
    return byClass;
  }, [db]);

  const unclaimed = useMemo(() => {
    const now = Date.now();
    return db.tickets
      .filter((t) => t.status === "unclaimed" || t.status === "ready_for_pickup")
      .map((ticket) => ({
        ticket,
        ageDays: Math.floor(
          (now - new Date(ticket.statusChangedAt).getTime()) / 86_400_000,
        ),
      }))
      .filter((row) => row.ageDays >= db.shop.unclaimedAfterDays / 2)
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [db.tickets, db.shop.unclaimedAfterDays]);

  const exportSales = () =>
    downloadCsv(
      `sales-${range}d.csv`,
      trend.map((row) => ({
        date: row.day,
        repairs: row.repair.toFixed(2),
        handsets: row.handset.toFixed(2),
        accessories: row.accessory.toFixed(2),
        total: (row.repair + row.handset + row.accessory).toFixed(2),
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
        <Button variant="outline" size="sm" onClick={exportSales}>
          <Download aria-hidden /> Export CSV
        </Button>
      </div>

      {/* KPI row — headline numbers are tiles, not a bar chart. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Gross sales"
          value={peso(grossSales, { whole: true })}
          hint={`${count(sales.length)} sale${sales.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Gross margin"
          value={peso(margin, { whole: true })}
          hint={
grossSales > 0
              ? `${Math.round((margin / grossSales) * 100)}% of sales`
              : "No sales in this range"
          }
        />
        <StatTile
          label="Jobs taken in"
          value={count(tickets.length)}
          hint={`${count(tickets.filter((t) => stageOf(t.status) === "closed").length)} closed`}
        />
        <StatTile
          label="Stock at cost"
          value={peso(
            valuation.handset + valuation.accessory + valuation.spare_part,
            { whole: true },
          )}
          hint="Handsets, accessories, parts"
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
                  className="h-0.5 w-3 rounded-full"
                  style={{ background: series.token }}
                  aria-hidden
                />
                {series.label}
              </span>
            ))}
          </div>
        </PanelHeader>

        <PanelBody>
          {grossSales === 0 ? (
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
                    dataKey="day"
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

        {showTable ? (
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
                  .filter((row) => row.repair + row.handset + row.accessory > 0)
                  .map((row) => (
                    <TableRow key={row.day}>
                      <TableCell className="mono text-xs">{row.day}</TableCell>
                      <TableNumeric>{peso(row.repair)}</TableNumeric>
                      <TableNumeric>{peso(row.handset)}</TableNumeric>
                      <TableNumeric>{peso(row.accessory)}</TableNumeric>
                      <TableNumeric className="font-semibold">
                        {peso(row.repair + row.handset + row.accessory)}
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
          <PanelTitle>Inventory valuation</PanelTitle>
        </PanelHeader>
        <ul className="divide-y divide-rule-soft">
          {(
            [
              ["Handsets", valuation.handset, "var(--series-handset)"],
              ["Accessories", valuation.accessory, "var(--series-accessory)"],
              ["Spare parts", valuation.spare_part, "var(--series-repair)"],
            ] as const
          ).map(([label, value, token]) => (
            <li key={label} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: token }}
                aria-hidden
              />
              <span className="flex-1 text-sm text-ink">{label}</span>
              <span className="mono text-sm font-medium text-ink">
                {peso(value, { whole: true })}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-3 border-t border-rule px-3 py-2.5 sm:px-4">
            <span className="flex-1 text-sm font-semibold text-ink">Total at cost</span>
            <span className="mono text-sm font-semibold text-ink">
              {peso(
                valuation.handset + valuation.accessory + valuation.spare_part,
                { whole: true },
              )}
            </span>
          </li>
        </ul>
      </Panel>

      {/* Aging units: a table, because every row needs acting on. */}
      <Panel>
        <PanelHeader>
          <TriangleAlert className="size-3.5 text-flag-ink" aria-hidden />
          <PanelTitle>Aging and unclaimed units</PanelTitle>
          <span className="mono ml-auto text-xs text-ink-faint">
            {unclaimed.length} unit{unclaimed.length === 1 ? "" : "s"}
          </span>
        </PanelHeader>

        {unclaimed.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="Nothing is sitting too long."
            body="Units waiting past half the unclaimed window will appear here."
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
                {unclaimed.slice(0, 25).map(({ ticket, ageDays }) => {
                  const customer = db.customers.find((c) => c.id === ticket.customerId);
                  const critical = ageDays >= db.shop.unclaimedAfterDays;
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="mono text-xs font-semibold">
                        {ticket.ticketNo}
                      </TableCell>
                      <TableCell className="truncate">{customer?.name ?? "Walk-in"}</TableCell>
                      <TableCell className="truncate text-ink-soft">
                        {ticket.device.brand} {ticket.device.model}
                      </TableCell>
                      <TableCell>
                        <Badge variant={critical ? "stamp" : "flag"}>
                          {STAGE_META[stageOf(ticket.status)].label}
                        </Badge>
                      </TableCell>
                      <TableNumeric
                        className={cn("font-semibold", critical ? "text-stamp-ink" : "text-flag-ink")}
                      >
                        {ageDays}d
                      </TableNumeric>
                      <TableNumeric>
                        {ticket.balance > 0 ? peso(ticket.balance) : "—"}
                      </TableNumeric>
                    </TableRow>
                  );
                })}
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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-rule bg-copy p-3 shadow-panel sm:p-4">
      <p className="label-pad">{label}</p>
      <p className="figure mt-1.5 text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
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
            className="size-1.5 rounded-full"
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
