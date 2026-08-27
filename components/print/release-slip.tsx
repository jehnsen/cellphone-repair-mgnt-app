"use client";

import { formatClaimCode, formatDate, formatImei, formatMobile, peso } from "@/lib/format";
import { PRINT_CSS } from "@/components/print/print-css";
import type { Customer, ShopProfile, Ticket } from "@/lib/types";

/**
 * Handed over with the repaired unit: proof it was collected, and the
 * warranty terms it goes out under. The shop copy carries the signature the
 * counter keeps.
 */
export function ReleaseSlip({
  ticket,
  customer,
  shop,
}: {
  ticket: Ticket;
  customer?: Customer | null;
  shop: ShopProfile;
}) {
  const warranty = ticket.warranty;

  return (
    <div className="stub">
      <style>{PRINT_CSS}</style>

      {(["Customer copy", "Shop copy"] as const).map((copy, index) => (
        <section key={copy} className={index === 0 ? "copy" : "copy copy--second"}>
          <header className="head">
            <div>
              <p className="shop">{shop.name}</p>
              <p className="fine">
                {[shop.addressLine, shop.city].filter(Boolean).join(", ")}
              </p>
              {shop.mobile ? <p className="fine">{formatMobile(shop.mobile)}</p> : null}
            </div>
            <p className="copyLabel">Release · {copy}</p>
          </header>

          <div className="idBlock">
            <div>
              <p className="label">Job order no.</p>
              <p className="ticketNo">{ticket.ticketNo}</p>
            </div>
            <div className="claimBox">
              <p className="label">Claim code</p>
              <p className="claimCode">{formatClaimCode(ticket.claimCode)}</p>
            </div>
          </div>

          <dl className="grid">
            <Row label="Released to" value={ticket.releasedTo || customer?.name || "—"} />
            <Row
              label="Released on"
              value={ticket.releasedAt ? formatDate(ticket.releasedAt) : formatDate(new Date())}
            />
            <Row
              label="Device"
              value={`${ticket.device.brand} ${ticket.device.model}`.trim() || "—"}
            />
            <Row
              label={ticket.device.imei.replace(/\D/g, "").length === 15 ? "IMEI" : "Serial"}
              value={ticket.device.imei ? formatImei(ticket.device.imei) : "—"}
            />
          </dl>

          <table className="money">
            <tbody>
              <tr>
                <td>Total</td>
                <td>{peso(ticket.totalDue)}</td>
              </tr>
              <tr className="due">
                <td>Paid in full</td>
                <td>{peso(ticket.amountPaid)}</td>
              </tr>
            </tbody>
          </table>

          <div className="block">
            <p className="label">Warranty</p>
            <p className="body">
              {warranty && warranty.periodDays > 0
                ? `${warranty.periodDays} days — ${warranty.scope} Valid until ${formatDate(warranty.expiresAt)}.`
                : "No warranty on this job."}
            </p>
          </div>

          {warranty?.exclusions?.length ? (
            <div className="block">
              <p className="label">Not covered</p>
              <p className="body">{warranty.exclusions.join("; ")}.</p>
            </div>
          ) : null}

          <p className="terms">
            The unit was inspected and accepted in working order at release.
            Warranty covers the fault repaired only, and is void if the unit is
            opened elsewhere.
          </p>

          <div className="sign">
            <span>Received by (customer)</span>
            <span>Released by</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
