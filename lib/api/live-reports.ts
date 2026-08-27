import type { HttpClient } from "@/lib/api/http";
import type { ShopReports } from "@/lib/shop/contract";

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
      return {
        grossSales: num(payload.aggregate?.gross_sales),
        discountTotal: num(payload.aggregate?.discount_total),
        vatTotal: num(payload.aggregate?.vat_total),
        saleCount: num(payload.aggregate?.sale_count),
        byDay: (payload.rows ?? []).map((row) => ({
          date: String(row.business_date ?? ""),
          saleCount: num(row.sale_count),
          grossSales: num(row.gross_sales),
        })),
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
      }));
    },
  };
}
