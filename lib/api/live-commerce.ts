import { money } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { HttpClient } from "@/lib/api/http";
import type {
  DeviceBrandDto,
  PaymentDto,
  ProductCategoryDto,
  ProductDto,
  SaleDto,
  SerializedUnitDto,
  ShiftDto,
  StockLevelDto,
  StockMovementDto,
  SupplierDto,
} from "@/lib/api/dto";
import { toInventoryItem } from "@/lib/api/mappers";
import {
  toHandsetUnit,
  toSale,
  toShift,
  toStockMovement,
  toSupplier,
} from "@/lib/api/mappers-commerce";
import type { LiveContext } from "@/lib/api/live-api";
import type { ShopApi } from "@/lib/shop/contract";
import type { InventoryItem, Sale, Shift } from "@/lib/types";

/**
 * The commerce half of the live client: stock, point of sale, and the drawer.
 *
 * Three shapes differ enough from the local model to call out:
 *
 *   1. **The server prices the sale.** POS sends what is being sold and how
 *      many; unit prices, VAT, and the statutory discount all come back
 *      computed. The cart's own totals are a preview, never the record.
 *   2. **Payments are separate calls.** A sale is created, then each payment
 *      is posted to it — which is also how a split payment is expressed.
 *   3. **Stock lives in its own ledger.** Products carry no quantity; levels
 *      come from `/inventory/levels` and are merged onto the item.
 */

const reasonCodeFor: Record<string, string> = {
  damaged: "damage",
  lost: "loss",
  count_correction: "count_variance",
  return_supplier: "return_to_supplier",
  return_customer: "customer_return",
};

export function createCommerceApi(
  client: HttpClient,
  context: LiveContext,
): Partial<ShopApi> {
  const requireBranch = (): string => {
    const branch = context.branchUlid();
    if (!branch) {
      throw new ApiError(
        "No branch is attached to this session.",
        "Ask an owner to assign your account to a branch, then sign in again.",
        { code: "FORBIDDEN" },
      );
    }
    return branch;
  };

  const loadItems = () => loadInventory(client);


  const loadShift = async (ulid: string): Promise<Shift> => {
    const { data } = await client.get<ShiftDto>(`/shifts/${ulid}`);
    return toShift(data);
  };

  /** A sale is only whole once its payments are attached. */
  const loadSale = async (ulid: string): Promise<Sale> => {
    const [{ data }, payments] = await Promise.all([
      client.get<SaleDto>(`/sales/${ulid}`),
      client
        .get<PaymentDto[]>(`/sales/${ulid}/payments`)
        .then((response) => response.data ?? [])
        .catch(() => [] as PaymentDto[]),
    ]);
    return toSale({ ...data, payments: data.payments ?? payments });
  };

  return {
    /* ── Catalog ───────────────────────────────────────────────────── */

    async getProductRefs() {
      const [categories, brands] = await Promise.all([
        client.getAll<ProductCategoryDto>("/product-categories", {
          query: { "filter[is_active]": "true", sort: "name" },
        }),
        client.getAll<DeviceBrandDto>("/device-brands", {
          query: { "filter[is_active]": "true", sort: "name" },
        }),
      ]);

      return {
        categories: categories.map((row) => ({ id: row.ulid, name: row.name })),
        brands: brands.map((row) => ({ id: row.ulid, name: row.name })),
      };
    },

    async createItem(input) {
      const { data } = await client.post<ProductDto>("/products", {
        body: {
          sku: input.sku.trim(),
          barcode: input.barcode?.trim() || null,
          name: input.name.trim(),
          product_category_ulid: input.categoryId,
          device_brand_ulid: input.brandId || null,
          type: input.itemClass === "spare_part" ? "part" : input.itemClass,
          cost: input.unitCost,
          selling_price: input.sellingPrice,
          /* A handset is tracked one IMEI at a time; everything else is a
             quantity on a shelf. */
          is_serialized: input.itemClass === "handset",
          reorder_point: input.reorderPoint,
          track_inventory: true,
          is_active: true,
        },
      });

      return toInventoryItem(data);
    },
    /* ── Inventory ─────────────────────────────────────────────────── */

    async getItems(query = {}) {
      const items = await loadItems();
      const needle = query.search?.trim().toLowerCase();

      return items.filter((item) => {
        if (query.itemClass && item.itemClass !== query.itemClass) return false;
        if (query.lowStockOnly && item.quantityOnHand > item.reorderPoint) return false;
        if (needle) {
          const haystack = [
            item.name,
            item.sku,
            item.brand,
            item.barcode ?? "",
            ...(item.compatibleModels ?? []),
            ...(item.units ?? []).map((unit) => unit.imei),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });
    },

    async getMovements(itemId) {
      const rows = await client.getAll<StockMovementDto>("/inventory/movements");
      const movements = rows.map(toStockMovement);
      return itemId
        ? movements.filter((movement) => movement.itemId === itemId)
        : movements;
    },

    async getSuppliers() {
      const rows = await client.getAll<SupplierDto>("/suppliers", {
        query: { sort: "name" },
      });
      return rows.map(toSupplier);
    },

    async receiveStock(input) {
      const branchUlid = requireBranch();

      /* Serialized handsets are registered one unit at a time, each with its
         own IMEI; everything else arrives as a goods receipt. */
      if (input.units?.length) {
        for (const unit of input.units) {
          await client.post<SerializedUnitDto>("/serialized-units", {
            body: {
              product_ulid: input.itemId,
              branch_ulid: branchUlid,
              imei: unit.imei.replace(/\D/g, "") || null,
              serial_number: unit.imei.replace(/\D/g, "") ? null : unit.imei,
              condition: unit.condition,
              acquisition_cost: unit.cost,
              acquisition_source: "supplier",
              warranty_terms: unit.warrantyDays
                ? `${unit.warrantyDays} days`
                : null,
            },
          });
        }
      } else {
        if (!input.supplierId) {
          throw new ApiError(
            "Receiving needs a supplier.",
            "Pick the supplier this delivery came from, then try again.",
            { code: "VALIDATION_FAILED" },
          );
        }
        await client.post("/goods-receipts", {
          body: {
            branch_ulid: branchUlid,
            supplier_ulid: input.supplierId,
            lines: [
              {
                product_ulid: input.itemId,
                quantity: input.quantity ?? 0,
                unit_cost: input.unitCost ?? 0,
              },
            ],
          },
        });
      }

      const items = await loadItems();
      const updated = items.find((item) => item.id === input.itemId);
      if (!updated) {
        throw new ApiError(
          "That item was not found after receiving.",
          "The stock was recorded. Reload the inventory list to see it.",
          { code: "NOT_FOUND" },
        );
      }
      return updated;
    },

    async adjustStock(input) {
      const branchUlid = requireBranch();

      if (input.unitId) {
        /* Retiring a handset is a status change on the unit itself, which
           posts its own -1 movement server-side. */
        await client.patch<SerializedUnitDto>(`/serialized-units/${input.unitId}`, {
          body: {
            status: input.unitStatus === "in_stock" ? "in_stock" : "written_off",
          },
        });
      } else {
        await client.post("/stock-adjustments", {
          body: {
            branch_ulid: branchUlid,
            reason_code: reasonCodeFor[input.reason] ?? input.reason,
            note: input.note ?? null,
            lines: [
              {
                product_ulid: input.itemId,
                quantity_delta: input.quantity ?? 0,
                unit_cost: 0,
              },
            ],
          },
        });
      }

      const items = await loadItems();
      const updated = items.find((item) => item.id === input.itemId);
      if (!updated) {
        throw new ApiError(
          "That item was not found after adjusting.",
          "The adjustment was recorded. Reload the inventory list to see it.",
          { code: "NOT_FOUND" },
        );
      }
      return updated;
    },

    /* ── Point of sale ─────────────────────────────────────────────── */

    async getSales(query = {}) {
      const rows = await client.getAll<SaleDto>("/sales", {
        query: {
          sort: "-created_at",
          "filter[created_from]": query.from,
          "filter[created_to]": query.to,
        },
      });

      const sales = rows.map(toSale);
      const needle = query.search?.trim().toLowerCase();
      return needle
        ? sales.filter((sale) => sale.saleNo.toLowerCase().includes(needle))
        : sales;
    },

    async getSale(id) {
      return loadSale(id);
    },

    async createSale(input) {
      const lines = input.lines.map((line) => {
        if (line.kind === "handset" && line.unitId) {
          return {
            sellable_type: "serialized_unit",
            serialized_unit_ulid: line.unitId,
            quantity: 1,
            discount: line.discount
              ? { type: line.discount.kind, value: line.discount.value }
              : undefined,
          };
        }
        if (line.kind === "service" && line.itemId) {
          return {
            sellable_type: "service",
            service_ulid: line.itemId,
            quantity: line.quantity,
            discount: line.discount
              ? { type: line.discount.kind, value: line.discount.value }
              : undefined,
          };
        }
        if (!line.itemId) {
          throw new ApiError(
            `"${line.name}" cannot be sold yet.`,
            "Walk-in charges need a service in the catalog. Add one in Settings, then ring it up.",
            { code: "VALIDATION_FAILED" },
          );
        }
        return {
          sellable_type: "product",
          product_ulid: line.itemId,
          quantity: line.quantity,
          discount: line.discount
            ? { type: line.discount.kind, value: line.discount.value }
            : undefined,
        };
      });

      /* The statutory relief and an ordinary order discount are the same
         field server-side; the senior/PWD ID wins when both are present. */
      const saleDiscount = input.seniorPwd
        ? {
            type: input.seniorPwd.type === "pwd" ? "pwd" : "senior_citizen",
            id_type: input.seniorPwd.type === "pwd" ? "PWD" : "OSCA",
            id_number: input.seniorPwd.idNumber,
            cardholder_name: input.seniorPwd.name,
          }
        : input.orderDiscount && input.orderDiscount.value > 0
          ? {
              type: input.orderDiscount.kind,
              value: input.orderDiscount.value,
            }
          : undefined;

      const { data: created } = await client.post<SaleDto>("/sales", {
        body: {
          customer_ulid: input.customerId ?? null,
          lines,
          sale_discount: saleDiscount,
        },
      });

      /* Each payment is its own call — which is also how a split tender is
         expressed. The server rejects the sum overshooting the total. A
         `trade_in` line carries the acquisition backing it instead of a
         reference number, and never touches `expected_cash`. */
      for (const payment of input.payments) {
        if (payment.amount <= 0) continue;
        await client.post<PaymentDto>(`/sales/${created.ulid}/payments`, {
          body: {
            method: payment.method,
            amount: money(payment.amount),
            reference_number: payment.reference ?? null,
            tendered: payment.tendered ?? null,
            ...(payment.acquisitionUlid
              ? { acquisition_ulid: payment.acquisitionUlid }
              : {}),
          },
        });
      }

      return loadSale(created.ulid);
    },

    /* ── Cash drawer ───────────────────────────────────────────────── */

    async getShifts() {
      const rows = await client.getAll<ShiftDto>("/shifts", {
        query: { sort: "-opened_at" },
      });
      return rows.map(toShift);
    },

    async getOpenShift() {
      const rows = await client.getAll<ShiftDto>("/shifts", {
        query: { "filter[is_open]": "true", sort: "-opened_at" },
      });

      /* The drawer belongs to a cashier, not to the shop: the server records
         a sale against `findOpenFor($request->user())`. Taking any open shift
         here let the POS believe a drawer was open when it belonged to
         somebody else — the cart then failed at checkout with SHIFT_NOT_OPEN,
         and the day sheet reported another person's cash as on hand. */
      const me = context.currentUser()?.id;
      const open = rows.find(
        (shift) => shift.is_open && (!me || shift.cashier?.ulid === me),
      );

      /* The list omits cash movements; the drawer screen needs them. */
      return open ? loadShift(open.ulid) : null;
    },

    async openShift({ startingCash }) {
      const { data } = await client.post<ShiftDto>("/shifts/open", {
        body: { opening_float: money(startingCash) },
      });
      return toShift(data);
    },

    async closeShift({ shiftId, countedCash, note }) {
      const { data } = await client.post<ShiftDto>(`/shifts/${shiftId}/close`, {
        body: { counted_cash: money(countedCash), notes: note ?? null },
      });
      return toShift(data);
    },

    async addCashMovement({ shiftId, kind, amount, reason }) {
      await client.post(`/shifts/${shiftId}/cash-movements`, {
        body: {
          direction: kind === "cash_in" ? "in" : "out",
          amount: money(amount),
          reason,
        },
      });
      return loadShift(shiftId);
    },
  };
}

/**
 * Stock levels and serialized units, folded onto the catalog rows.
 *
 * Products carry no quantity of their own: non-serialized stock comes from
 * the derived /inventory/levels cache, and a handset is counted by its units.
 * Exported so first load and every later refresh build items the same way.
 */
export async function loadInventory(client: HttpClient): Promise<InventoryItem[]> {
  const [products, levels, units, movements] = await Promise.all([
    client.getAll<ProductDto>("/products", {
      query: { include: "compatibleDeviceModels" },
    }),
    client.getAll<StockLevelDto>("/inventory/levels").catch(() => [] as StockLevelDto[]),
    client
      .getAll<SerializedUnitDto>("/serialized-units")
      .catch(() => [] as SerializedUnitDto[]),
    /* The ledger is the only place a product's last movement is recorded —
       without it the inventory list's "last movement" column is always
       blank. Cheap for a shop this size; the getAll page cap is the guard. */
    client
      .getAll<StockMovementDto>("/inventory/movements")
      .catch(() => [] as StockMovementDto[]),
  ]);

  const lastMovement = new Map<string, string>();
  for (const movement of movements) {
    const ulid = movement.product?.ulid;
    const at = movement.occurred_at;
    if (!ulid || !at) continue;
    const current = lastMovement.get(ulid);
    if (!current || new Date(at) > new Date(current)) lastMovement.set(ulid, at);
  }

  const onHand = new Map<string, number>();
  for (const level of levels) {
    const ulid = level.product?.ulid;
    if (ulid) onHand.set(ulid, Number(level.on_hand_qty ?? 0));
  }

  const unitsByProduct = new Map<string, SerializedUnitDto[]>();
  for (const unit of units) {
    const ulid = unit.product?.ulid;
    if (!ulid) continue;
    unitsByProduct.set(ulid, [...(unitsByProduct.get(ulid) ?? []), unit]);
  }

  return products.map((dto) => {
    const item = toInventoryItem(dto);

    if (item.itemClass === "handset") {
      item.units = (unitsByProduct.get(dto.ulid) ?? []).map((unit) =>
        toHandsetUnit(unit, item.id),
      );
      item.quantityOnHand = item.units.filter(
        (unit) => unit.status === "in_stock" || unit.status === "reserved",
      ).length;
    } else {
      item.quantityOnHand = onHand.get(dto.ulid) ?? 0;
    }

    item.lastMovementAt = lastMovement.get(dto.ulid);

    return item;
  });
}
