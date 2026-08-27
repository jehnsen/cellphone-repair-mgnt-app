"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatClaimCode, formatDate, formatImei, formatMobile, peso } from "@/lib/format";
import { PRINT_CSS } from "@/components/print/print-css";
import type { Customer, ShopProfile, Ticket } from "@/lib/types";

/**
 * The paper the customer walks out with, and the shop's own copy.
 *
 * Printed at A5-ish width on plain paper. Everything a counter needs to hand
 * the unit back is on it: the claim code (read aloud over the phone, so it is
 * the largest thing here), what was taken in, what was promised, and what is
 * still owed. The QR encodes the ticket number so release can scan instead of
 * type.
 *
 * Deliberately black-on-white with hairline rules — a thermal or laser printer
 * renders tints as mud, so nothing here depends on colour to be readable.
 */
export function ClaimStub({
  ticket,
  customer,
  shop,
}: {
  ticket: Ticket;
  customer?: Customer | null;
  shop: ShopProfile;
}) {
  const qr = useQrCode(ticket.ticketNo);
  const device = `${ticket.device.brand} ${ticket.device.model}`.trim();

  return (
    <div className="stub">
      <style>{PRINT_CSS}</style>

      {/* Two copies on one sheet: the customer tears off the top. */}
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
            <p className="copyLabel">{copy}</p>
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
            {/* Spacer column: pushes the QR to the right edge instead of
                leaving a gap in the middle of the band. */}
            <span aria-hidden />
            {qr ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="qr" src={qr} alt={`QR code for ${ticket.ticketNo}`} />
            ) : (
              <span aria-hidden />
            )}
          </div>

          <dl className="grid">
            <Row label="Customer" value={customer?.name ?? "Walk-in"} />
            <Row
              label="Mobile"
              value={customer?.mobile ? formatMobile(customer.mobile) : "—"}
            />
            <Row label="Device" value={device || "—"} />
            <Row
              label={ticket.device.imei.replace(/\D/g, "").length === 15 ? "IMEI" : "Serial"}
              value={
                ticket.device.imei
                  ? formatImei(ticket.device.imei)
                  : "—"
              }
            />
            <Row label="Taken in" value={formatDate(ticket.createdAt)} />
            <Row label="Promised" value={formatDate(ticket.promisedAt)} />
          </dl>

          {/* Paired: a two-word complaint and one accessory should not each
              claim a full-width line and leave the sheet half empty. */}
          <div className="blocks">
            <div className={ticket.turnedOver.length ? "block" : "block block--wide"}>
              <p className="label">Reported problem</p>
              <p className="body problem">{ticket.reportedProblem || "—"}</p>
            </div>

            {ticket.turnedOver.length ? (
              <div className="block">
                <p className="label">Turned over with the unit</p>
                <p className="body">
                  {ticket.turnedOver.map((item) => TURNED_OVER[item] ?? item).join(", ")}
                </p>
              </div>
            ) : null}
          </div>

          <table className="money">
            <tbody>
              <tr>
                <td>Estimate</td>
                <td>{peso(ticket.totalDue)}</td>
              </tr>
              <tr>
                <td>Paid on intake</td>
                <td>{peso(ticket.amountPaid)}</td>
              </tr>
              <tr className="due">
                <td>Balance on release</td>
                <td>{peso(ticket.balance)}</td>
              </tr>
            </tbody>
          </table>

          <p className="terms">
            {shop.receiptFooter ||
              "Keep this slip — you need it to claim your unit. No slip, valid ID required."}
            {ticket.warrantyDays > 0
              ? ` Repairs carry a ${ticket.warrantyDays}-day warranty on the fault repaired.`
              : " No warranty on this job."}
            {shop.unclaimedAfterDays
              ? ` Units unclaimed ${shop.unclaimedAfterDays} days after the promised date may be disposed of to recover costs.`
              : ""}
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

const TURNED_OVER: Record<string, string> = {
  sim: "SIM card",
  sd_card: "SD card",
  case: "Case",
  charger: "Charger",
  box: "Box",
};

/** Encodes the ticket number so release can scan rather than retype it. */
function useQrCode(value: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      margin: 0,
      width: 160,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setUrl(data);
      })
      /* A stub without a QR is still a valid stub — the code is printed. */
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return url;
}

