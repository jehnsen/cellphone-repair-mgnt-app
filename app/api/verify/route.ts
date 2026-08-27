import { NextResponse } from "next/server";
import { HttpClient } from "@/lib/api/http";
import { signIn, createLiveApi } from "@/lib/api/live-api";
import { createCommerceApi } from "@/lib/api/live-commerce";
import { createUnavailableApi } from "@/lib/api/unavailable";
import { bootstrapShop } from "@/lib/api/shop-api";
import { toUser } from "@/lib/api/mappers";

export const dynamic = "force-dynamic";

/** Drives every newly wired context through the app's own client. */
export async function GET() {
  const client = new HttpClient();
  const session = await signIn(client, {
    email: "ricardo.santos@fixmo.test",
    password: "password",
  });
  const self = toUser(session.user);
  const context = {
    branchUlid: () => session.branch?.ulid ?? null,
    currentUser: () => self,
  };
  const api = {
    ...createUnavailableApi(),
    ...createLiveApi(client, context),
    ...createCommerceApi(client, context),
  };

  const boot = await bootstrapShop(client, session.branch, self);

  const [items, movements, suppliers, sales, shifts, openShift] = await Promise.all([
    api.getItems({}),
    api.getMovements(),
    api.getSuppliers(),
    api.getSales({}),
    api.getShifts(),
    api.getOpenShift(),
  ]);

  const handsets = items.filter((item) => item.itemClass === "handset");
  const stocked = items.filter((item) => item.quantityOnHand > 0);
  const paidTicket = boot.db.tickets.find((ticket) => ticket.amountPaid > 0);
  const detail = paidTicket ? await api.getTicket(paidTicket.id) : null;

  return NextResponse.json({
    bootstrap: {
      tickets: boot.db.tickets.length,
      customers: boot.db.customers.length,
      items: boot.db.items.length,
      services: boot.db.services.length,
      suppliers: boot.db.suppliers.length,
      sales: boot.db.sales.length,
      shifts: boot.db.shifts.length,
      warnings: boot.warnings,
    },
    inventory: {
      items: items.length,
      withStock: stocked.length,
      totalOnHand: items.reduce((sum, item) => sum + item.quantityOnHand, 0),
      handsetModels: handsets.length,
      serializedUnits: handsets.reduce(
        (sum, item) => sum + (item.units?.length ?? 0),
        0,
      ),
      movements: movements.length,
      movementReasons: [...new Set(movements.map((m) => m.reason))],
      suppliers: suppliers.length,
    },
    pos: {
      sales: sales.length,
      sampleSale: sales[0]
        ? {
            saleNo: sales[0].saleNo,
            lines: sales[0].lines.length,
            subtotal: sales[0].subtotal,
            vatAmount: sales[0].vatAmount,
            totalDue: sales[0].totalDue,
            payments: sales[0].payments.map((p) => `${p.method} ${p.amount}`),
            status: sales[0].status,
          }
        : null,
    },
    drawer: {
      shifts: shifts.length,
      openShift: openShift
        ? {
            shiftNo: openShift.shiftNo,
            startingCash: openShift.startingCash,
            expectedCash: openShift.expectedCash,
            movements: openShift.movements.length,
            status: openShift.status,
          }
        : null,
    },
    ticketPayments: detail
      ? {
          ticketNo: detail.ticketNo,
          payments: detail.payments.map((p) => `${p.kind} ${p.method} ${p.amount}`),
          amountPaid: detail.amountPaid,
          balance: detail.balance,
        }
      : null,
  });
}
