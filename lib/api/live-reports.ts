import type { HttpClient } from "@/lib/api/http";
import type { AgingBucket, RevenueSplit, ShopReports } from "@/lib/shop/contract";
import { STATUS_META } from "@/lib/status";
import type { TicketStatus } from "@/lib/types";

/**
 * The server's own reporting. These are computed in SQL over the whole shop,
 * so they are the figures of record — the screens must not re-derive them
 * from whatever happens to be cached in the browser.
 *
 * Every payload is `{ aggregate?, rows }` with numbers as decimal strings;
 * `num()` at the call site turns them into numbers.
 */

const num = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface ReportPayload {
  aggregate?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
}

/**
 * The repair/handset/accessory split off one row.
 *
 * The server may name these columns per line kind, or not break sales down at
 * all. When the split is absent, everything lands under `repair` so the three
 * series still sum to the gross the same row reports — a chart that under-
 * counts would be worse than one that attributes coarsely.
 */
function splitOf(row: Record<string, unknown>, gross: number): RevenueSplit {
  const repair = row.repair_sales ?? row.service_sales ?? row.repair;
  const handset = row.handset_sales ?? row.handset;
  const accessory = row.accessory_sales ?? row.accessory;

  if (repair === undefined && handset === undefined && accessory === undefined) {
    return { repair: gross, handset: 0, accessory: 0 };
  }

  return {
    repair: num(repair),
    handset: num(handset),
    accessory: num(accessory),
  };
}

/** Sums a split across days, for a range total the server did not aggregate. */
function addSplit(a: RevenueSplit, b: RevenueSplit): RevenueSplit {
  return {
    repair: a.repair + b.repair,
    handset: a.handset + b.handset,
    accessory: a.accessory + b.accessory,
  };
}

/**
 * Trusts the server's status only when it is one the board knows how to draw.
 * Keyed off `STATUS_META` rather than a second copy of the list, so a new
 * status is understood here the moment it is added to the domain.
 */
function toStatus(value: unknown, fallback: TicketStatus): TicketStatus {
  const text = String(value ?? "");
  return text in STATUS_META ? (text as TicketStatus) : fallback;
}

type Dict = Record<string, unknown>;
const obj = (value: unknown): Dict =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : {};
const list = (value: unknown): Dict[] => (Array.isArray(value) ? (value as Dict[]) : []);

/**
 * A breakdown the server sends either as a keyed object (`{ cash: "400.00" }`
 * or `{ cash: { amount, count } }`) or as an array of rows. Flattened to one
 * shape so the UI does not have to branch on it.
 */
function toBreakdown(
  value: unknown,
): { key: string; amount: number; count: number }[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const row = obj(entry);
      return {
        key: String(row.key ?? row.method ?? row.reason ?? row.name ?? "—"),
        amount: num(row.amount ?? row.total),
        count: num(row.count),
      };
    });
  }
  return Object.entries(obj(value)).map(([key, raw]) => {
    if (raw && typeof raw === "object") {
      const row = raw as Dict;
      return { key, amount: num(row.amount ?? row.total), count: num(row.count) };
    }
    return { key, amount: num(raw), count: 0 };
  });
}

/** A tender-method → amount map, from an object or an array of rows. */
function toTenderTotals(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      const row = obj(entry);
      out[String(row.method ?? row.key ?? row.name ?? "—")] = num(
        row.amount ?? row.total,
      );
    }
    return out;
  }
  for (const [key, raw] of Object.entries(obj(value))) {
    out[key] =
      raw && typeof raw === "object"
        ? num((raw as Dict).amount ?? (raw as Dict).total)
        : num(raw);
  }
  return out;
}

const AGING_BUCKETS: AgingBucket[] = ["0-30", "31-60", "61-90", "90+"];

function toBucket(value: unknown): AgingBucket {
  const text = String(value ?? "").trim().replace(/_/g, "-").replace(/\s+/g, "");
  if (text === "0-30" || text === "31-60" || text === "61-90") return text;
  if (/^90/.test(text)) return "90+";
  return "0-30";
}

export function createReportsApi(client: HttpClient): ShopReports {
  const fetchReport = async (
    path: string,
    range?: { from?: string; to?: string; days?: number },
  ): Promise<ReportPayload> => {
    const { data } = await client.get<ReportPayload>(path, {
      query: {
        date_from: range?.from,
        date_to: range?.to,
        days: range?.days,
      },
    });
    return data ?? {};
  };

  /**
   * Same call, but keeps `meta.generated_at` and hands back the raw `data`
   * object — the four counter-finance reports need the timestamp, and one of
   * them (`refunds-voids`) puts an object, not an array, at `rows`.
   */
  const fetchReportFull = async (
    path: string,
    range?: { from?: string; to?: string; days?: number },
  ): Promise<{ data: Dict; generatedAt: string }> => {
    const response = await client.get<Dict>(path, {
      query: {
        date_from: range?.from,
        date_to: range?.to,
        days: range?.days,
      },
    });
    const data = obj(response.data);
    const generatedAt = String(
      (response.meta as Dict | undefined)?.generated_at ??
        data.generated_at ??
        new Date().toISOString(),
    );
    return { data, generatedAt };
  };

  return {
    async getSalesReport(range) {
      const payload = await fetchReport("/reports/sales", range);

      const byDay = (payload.rows ?? []).map((row) => {
        const grossSales = num(row.gross_sales);
        return {
          date: String(row.business_date ?? ""),
          saleCount: num(row.sale_count),
          grossSales,
          ...splitOf(row, grossSales),
        };
      });

      const aggregate = payload.aggregate ?? {};
      const grossSales = num(aggregate.gross_sales);
      /* Prefer the server's own split; fall back to summing the days it
         returned so the tiles and the chart always tell the same story. */
      const totals =
        aggregate.repair_sales !== undefined ||
        aggregate.handset_sales !== undefined ||
        aggregate.accessory_sales !== undefined
          ? splitOf(aggregate, grossSales)
          : byDay.reduce(addSplit, { repair: 0, handset: 0, accessory: 0 });

      return {
        grossSales,
        discountTotal: num(aggregate.discount_total),
        vatTotal: num(aggregate.vat_total),
        saleCount: num(aggregate.sale_count),
        totals,
        byDay,
      };
    },

    async getMarginReport(range) {
      const payload = await fetchReport("/reports/margin", range);
      return {
        revenue: num(payload.aggregate?.revenue),
        cogs: num(payload.aggregate?.cogs),
        grossMargin: num(payload.aggregate?.gross_margin),
      };
    },

    async getTechnicianThroughput(range) {
      const payload = await fetchReport("/reports/technician-throughput", range);
      return (payload.rows ?? []).map((row) => ({
        technician: String(row.technician ?? row.name ?? "Unassigned"),
        ticketCount: num(row.ticket_count ?? row.tickets),
        averageTurnaroundHours: num(row.avg_turnaround_hours ?? row.average_hours),
      }));
    },

    async getMostRepairedModels(range) {
      const payload = await fetchReport("/reports/most-repaired-models", range);
      return (payload.rows ?? []).map((row) => ({
        model: String(row.model ?? row.device_model ?? "Unknown"),
        ticketCount: num(row.ticket_count ?? row.count),
      }));
    },

    async getInventoryValuation() {
      const payload = await fetchReport("/reports/inventory-valuation");
      return {
        totalCostValue: num(payload.aggregate?.total_cost_value),
        totalRetailValue: num(payload.aggregate?.total_retail_value),
        skuCount: num(payload.aggregate?.sku_count),
        rows: (payload.rows ?? []).map((row) => ({
          product: String(row.product ?? ""),
          onHand: num(row.on_hand_qty),
          costValue: num(row.cost_value),
          retailValue: num(row.retail_value),
        })),
      };
    },

    async getDeadStock(days = 60) {
      const payload = await fetchReport("/reports/dead-stock", { days });
      return (payload.rows ?? []).map((row) => ({
        product: String(row.product ?? ""),
        onHand: num(row.on_hand_qty),
        daysChecked: num(row.days_checked, days),
      }));
    },

    async getUnclaimedAging() {
      const payload = await fetchReport("/reports/unclaimed-aging");
      return (payload.rows ?? []).map((row) => ({
        ticketId: String(row.ulid ?? ""),
        ticketNo: String(row.ticket_number ?? ""),
        daysUnclaimed: num(row.days_unclaimed),
        customerName: String(row.customer_name ?? row.customer ?? "Walk-in"),
        device: [row.device_brand ?? row.brand, row.device_model ?? row.model]
          .filter(Boolean)
          .join(" "),
        /* These are the units nobody collected, so a row with no usable
           status is far likelier to be waiting than released. */
        status: toStatus(row.status, "ready_for_pickup"),
        balance: num(row.balance ?? row.balance_due),
      }));
    },

    /* ── Counter finance ─────────────────────────────────────────────── */

    async getRepairPnl(range) {
      const { data, generatedAt } = await fetchReportFull(
        "/reports/repair-pnl",
        range,
      );
      const agg = obj(data.aggregate);
      const totalRevenue = num(agg.total_revenue);
      const grossMargin = num(agg.gross_margin);

      /* The percentage is a ratio of two figures the same row provides, so
         it is derived here rather than trusted off the wire — a fraction
         and a percent look identical until one of them is wrong. */
      const pctOf = (margin: number, revenue: number) =>
        revenue > 0 ? margin / revenue : 0;

      return {
        partsRevenue: num(agg.parts_revenue),
        laborRevenue: num(agg.labor_revenue),
        totalRevenue,
        partsCost: num(agg.parts_cost),
        partsMargin: num(agg.parts_margin),
        grossMargin,
        grossMarginPct: pctOf(grossMargin, totalRevenue),
        paymentsCollected: num(agg.payments_collected),
        generatedAt,
        byTechnician: list(data.rows).map((row) => {
          const revenue = num(row.total_revenue);
          const margin = num(row.gross_margin);
          return {
            technician: String(
              row.technician ?? row.technician_name ?? row.name ?? "Unassigned",
            ),
            partsRevenue: num(row.parts_revenue),
            laborRevenue: num(row.labor_revenue),
            totalRevenue: revenue,
            partsCost: num(row.parts_cost),
            grossMargin: margin,
            grossMarginPct: pctOf(margin, revenue),
            paymentsCollected: num(row.payments_collected),
          };
        }),
      };
    },

    async getCashReconciliation(range) {
      const { data, generatedAt } = await fetchReportFull(
        "/reports/cash-reconciliation",
        range,
      );
      const agg = obj(data.aggregate);

      const shifts = list(data.rows).map((row) => {
        const open = Boolean(
          row.is_open ??
            row.open ??
            (row.closed_at == null && row.counted_cash == null),
        );
        const counted = row.counted_cash;
        const variance = row.variance;
        return {
          shiftId: String(row.ulid ?? row.shift_ulid ?? row.id ?? ""),
          shiftNo: String(
            row.shift_number ?? row.shift_no ?? row.number ?? "",
          ),
          branch: String(
            row.branch ?? row.branch_name ?? row.branch_code ?? "",
          ),
          cashier: String(
            row.cashier ?? row.cashier_name ?? row.opened_by ?? "—",
          ),
          openedAt: String(row.opened_at ?? ""),
          closedAt: String(row.closed_at ?? ""),
          open,
          openingFloat: num(row.opening_float),
          cashPayments: num(row.cash_payments),
          cashIn: num(row.cash_in),
          cashOut: num(row.cash_out),
          expectedCash: num(row.expected_cash),
          countedCash:
            open || counted == null || counted === "" ? null : num(counted),
          variance:
            open || variance == null || variance === "" ? null : num(variance),
          tenderBreakdown: toTenderTotals(
            row.tender_breakdown ?? row.tenders,
          ),
        };
      });

      return {
        tenderTotals: toTenderTotals(agg.tender_totals ?? agg.tenders),
        varianceTotal: num(agg.variance_total),
        expectedTotal: num(agg.expected_total ?? agg.expected_cash_total),
        countedTotal: num(agg.counted_total ?? agg.counted_cash_total),
        openShiftCount: num(
          agg.open_shift_count,
          shifts.filter((s) => s.open).length,
        ),
        generatedAt,
        shifts,
      };
    },

    async getRefundsVoids(range) {
      const { data, generatedAt } = await fetchReportFull(
        "/reports/refunds-voids",
        range,
      );
      const agg = obj(data.aggregate);
      const rows = obj(data.rows);
      const refundRows = list(rows.refunds);
      const voidRows = list(rows.voids);

      return {
        refundTotal: num(agg.refund_total),
        refundCount: num(agg.refund_count, refundRows.length),
        refundByMethod: toBreakdown(agg.refund_by_method),
        refundByReason: toBreakdown(agg.refund_by_reason),
        voidCount: num(agg.void_count, voidRows.length),
        voidTotal: num(agg.void_total),
        generatedAt,
        refunds: refundRows.map((row) => ({
          id: String(row.ulid ?? row.id ?? ""),
          saleNo: String(row.sale_number ?? row.sale_no ?? row.sale ?? ""),
          at: String(row.created_at ?? row.refunded_at ?? row.at ?? ""),
          amount: num(row.amount ?? row.total),
          method: String(row.method ?? row.refund_method ?? "—"),
          reason: String(row.reason ?? row.refund_reason ?? "—"),
          processor: String(
            row.processor ?? row.processed_by ?? row.actor ?? row.cashier ?? "—",
          ),
        })),
        voids: voidRows.map((row) => ({
          id: String(row.ulid ?? row.id ?? ""),
          saleNo: String(row.sale_number ?? row.sale_no ?? row.sale ?? ""),
          at: String(row.updated_at ?? row.voided_at ?? row.at ?? ""),
          amount: num(row.amount ?? row.total ?? row.sale_total),
          voidReason: String(row.void_reason ?? row.reason ?? "—"),
          processor: String(
            row.processor ?? row.processed_by ?? row.actor ?? row.cashier ?? "—",
          ),
        })),
      };
    },

    async getReceivablesAging() {
      const { data, generatedAt } = await fetchReportFull(
        "/reports/receivables-aging",
      );
      const agg = obj(data.aggregate);
      const bucketAgg = obj(agg.buckets ?? agg.aging ?? agg.by_bucket);

      const buckets = AGING_BUCKETS.map((bucket) => {
        const raw =
          bucketAgg[bucket] ?? bucketAgg[bucket.replace("-", "_")] ?? {};
        if (typeof raw === "number") return { bucket, count: 0, amount: raw };
        const cell = obj(raw);
        return {
          bucket,
          count: num(cell.count),
          amount: num(cell.amount ?? cell.total),
        };
      });

      return {
        totalOutstanding: num(agg.total_outstanding ?? agg.total),
        generatedAt,
        buckets,
        rows: list(data.rows).map((row) => ({
          ticketId: String(row.ulid ?? row.ticket_ulid ?? row.id ?? ""),
          ticketNo: String(row.ticket_number ?? row.ticket_no ?? ""),
          customerName: String(
            row.customer_name ?? row.customer ?? "Walk-in",
          ),
          device: [row.device_brand ?? row.brand, row.device_model ?? row.model]
            .filter(Boolean)
            .join(" "),
          branch: String(
            row.branch ?? row.branch_name ?? row.branch_code ?? "",
          ),
          balance: num(row.balance ?? row.balance_due ?? row.outstanding),
          daysOutstanding: num(
            row.days_outstanding ?? row.days ?? row.age_days,
          ),
          bucket: toBucket(row.bucket ?? row.aging_bucket),
          agingBasis: String(row.aging_basis ?? row.basis ?? ""),
        })),
      };
    },
  };
}
