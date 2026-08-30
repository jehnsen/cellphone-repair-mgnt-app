import type { HttpClient } from "@/lib/api/http";
import type { RevenueSplit, ShopReports } from "@/lib/shop/contract";
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
  };
}
