"use client";

import { amount, formatDateTime, formatMobile, peso } from "@/lib/format";
import { receiptCss } from "@/components/print/receipt-css";
import type { Customer, Sale, ShopProfile, User } from "@/lib/types";

/**
 * What the customer walks out with.
 *
 * Deliberately an **acknowledgement receipt / service invoice**, never a BIR
 * official receipt: the shop's OR numbers come off a BIR-registered pad and
 * are written on by hand, so this prints a labelled blank for that number
 * rather than minting one. The BIR registration block only appears when the
 * shop has switched it on in settings.
 */

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  bank_transfer: "Bank transfer",
  trade_in: "Trade-in",
};

export function SaleReceipt({
  sale,
  shop,
  cashier,
  customer,
  width = 80,
}: {
  sale: Sale;
  shop: ShopProfile;
  cashier?: User | null;
  customer?: Customer | null;
  width?: 58 | 80;
}) {
  const cash = sale.payments.find((payment) => payment.method === "cash");
  const change = cash?.change ?? 0;

  return (
    <div className="receipt">
      <style>{receiptCss(width)}</style>

      <div className="center">
        <p className="shop">{shop.name}</p>
        {shop.addressLine ? <p className="fine">{shop.addressLine}</p> : null}
        {shop.city ? <p className="fine">{shop.city}</p> : null}
        {shop.mobile ? <p className="fine">{formatMobile(shop.mobile)}</p> : null}

        {/* Only when the shop says it is registered — never invented. */}
        {shop.showBirDetails ? (
          <>
            {shop.tin ? <p className="fine">TIN {shop.tin}</p> : null}
            {shop.birPermitNo ? <p className="fine">Permit {shop.birPermitNo}</p> : null}
            {shop.serialNo ? <p className="fine">Serial {shop.serialNo}</p> : null}
          </>
        ) : null}
      </div>

      <div className="rule" />

      <p className="kind center">
        {shop.vatRegistered ? "Acknowledgement receipt" : "Service invoice"}
      </p>
      <p className="fine center">Not a BIR official receipt</p>

      <div className="rule" />

      <div className="row">
        <span>Sale no.</span>
        <span className="bold">{sale.saleNo}</span>
      </div>
      <div className="row">
        <span>Date</span>
        <span>{formatDateTime(sale.soldAt)}</span>
      </div>
      {cashier ? (
        <div className="row">
          <span>Served by</span>
          <span>{cashier.name}</span>
        </div>
      ) : null}
      {customer ? (
        <div className="row">
          <span>Customer</span>
          <span>{customer.name}</span>
        </div>
      ) : null}
      {/* Written on by hand off the BIR-registered pad. */}
      <div className="row">
        <span>OR no.</span>
        <span>{sale.officialReceiptNo ?? "____________"}</span>
      </div>

      <div className="rule" />

      {sale.lines.map((line) => (
        <div key={line.id} className="item">
          <p className="name">{line.name}</p>
          <div className="row qty">
            <span>
              {line.quantity} × {amount(line.unitPrice)}
            </span>
            <span>{amount(line.lineTotal)}</span>
          </div>
        </div>
      ))}

      <div className="rule" />

      <div className="totals">
        <div className="row">
          <span>Subtotal</span>
          <span>{amount(sale.subtotal)}</span>
        </div>

        {sale.orderDiscount && sale.orderDiscount.value > 0 ? (
          <div className="row">
            <span>
              Discount
              {sale.orderDiscount.kind === "percent"
                ? ` ${sale.orderDiscount.value}%`
                : ""}
            </span>
            <span>
              −{amount(Math.max(0, sale.subtotal - sale.totalDue - sale.vatAmount))}
            </span>
          </div>
        ) : null}

        {/* The statutory relief has to name the ID it was granted against. */}
        {sale.seniorPwdDiscount ? (
          <>
            <div className="row">
              <span>
                {sale.seniorPwdDiscount.type === "pwd" ? "PWD" : "Senior"} 20%
              </span>
              <span>−{amount(sale.seniorPwdDiscount.discountAmount)}</span>
            </div>
            <p className="fine">
              {sale.seniorPwdDiscount.name} · ID {sale.seniorPwdDiscount.idNumber}
            </p>
          </>
        ) : null}

        {shop.vatRegistered ? (
          <>
            {sale.vatableSales > 0 ? (
              <div className="row">
                <span>VATable sales</span>
                <span>{amount(sale.vatableSales)}</span>
              </div>
            ) : null}
            {sale.vatExemptSales > 0 ? (
              <div className="row">
                <span>VAT-exempt sales</span>
                <span>{amount(sale.vatExemptSales)}</span>
              </div>
            ) : null}
            <div className="row">
              <span>VAT {Math.round(shop.vatRate * 100)}%</span>
              <span>{amount(sale.vatAmount)}</span>
            </div>
          </>
        ) : null}

        <div className="rule" />

        <div className="row total">
          <span>TOTAL</span>
          <span>{peso(sale.totalDue)}</span>
        </div>
      </div>

      <div className="rule" />

      {sale.payments.map((payment) => (
        <div key={payment.id} className="row">
          <span>
            {METHOD_LABEL[payment.method] ?? payment.method}
            {payment.reference ? ` ${payment.reference}` : ""}
          </span>
          <span>{amount(payment.amount)}</span>
        </div>
      ))}

      {cash?.tendered ? (
        <div className="row">
          <span>Cash tendered</span>
          <span>{amount(cash.tendered)}</span>
        </div>
      ) : null}
      {change > 0 ? (
        <div className="row bold">
          <span>Change</span>
          <span>{amount(change)}</span>
        </div>
      ) : null}

      <div className="rule" />

      <p className="foot center">{shop.receiptFooter}</p>
      <p className="foot center">Keep this receipt for warranty claims.</p>
    </div>
  );
}
