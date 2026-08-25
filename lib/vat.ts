import { money } from "@/lib/format";
import type { Discount } from "@/lib/types";

/**
 * Statutory computation, in one place because the receipt, the POS totals
 * panel, and the sales reports must all agree.
 *
 * VAT-registered shop:
 *   - Ordinary sale: the price on the shelf is VAT-inclusive.
 *       vatable = gross / 1.12,  VAT = gross - vatable
 *   - Senior citizen / PWD sale (RA 9994 / RA 10754): the sale is
 *     VAT-exempt, so VAT comes off first, then the 20% discount is taken
 *     on the VAT-exempt (net) amount.
 *       net = gross / 1.12,  discount = net * 0.20,  due = net - discount
 *
 * Non-VAT shop (percentage tax):
 *   - No VAT line at all. The 20% senior/PWD discount is taken on the
 *     gross selling price.
 */

export const SENIOR_PWD_RATE = 0.2;

export interface TaxInput {
  /** Sum of line totals, after line-level discounts, VAT-inclusive. */
  subtotal: number;
  orderDiscount?: Discount;
  seniorPwd?: { applies: boolean };
  vatRegistered: boolean;
  vatRate: number;
}

export interface TaxResult {
  /** Ordinary order-level discount (percent or amount). */
  orderDiscountAmount: number;
  /** Statutory 20% relief, zero unless a senior/PWD ID was captured. */
  seniorPwdDiscount: number;
  vatableSales: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  vatAmount: number;
  totalDue: number;
}

export function applyDiscount(base: number, discount?: Discount): number {
  if (!discount || discount.value <= 0) return 0;
  const raw =
    discount.kind === "percent" ? base * (discount.value / 100) : discount.value;
  return money(Math.min(raw, base));
}

export function computeTax(input: TaxInput): TaxResult {
  const { subtotal, orderDiscount, seniorPwd, vatRegistered, vatRate } = input;

  const orderDiscountAmount = applyDiscount(subtotal, orderDiscount);
  const gross = money(subtotal - orderDiscountAmount);
  const senior = seniorPwd?.applies === true;

  if (!vatRegistered) {
    const seniorPwdDiscount = senior ? money(gross * SENIOR_PWD_RATE) : 0;
    const totalDue = money(gross - seniorPwdDiscount);
    return {
      orderDiscountAmount,
      seniorPwdDiscount,
      vatableSales: 0,
      vatExemptSales: 0,
      zeroRatedSales: 0,
      vatAmount: 0,
      totalDue,
    };
  }

  if (senior) {
    const net = money(gross / (1 + vatRate));
    const seniorPwdDiscount = money(net * SENIOR_PWD_RATE);
    return {
      orderDiscountAmount,
      seniorPwdDiscount,
      vatableSales: 0,
      vatExemptSales: net,
      zeroRatedSales: 0,
      vatAmount: 0,
      totalDue: money(net - seniorPwdDiscount),
    };
  }

  const vatableSales = money(gross / (1 + vatRate));
  return {
    orderDiscountAmount,
    seniorPwdDiscount: 0,
    vatableSales,
    vatExemptSales: 0,
    zeroRatedSales: 0,
    vatAmount: money(gross - vatableSales),
    totalDue: gross,
  };
}
