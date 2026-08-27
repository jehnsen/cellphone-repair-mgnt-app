/**
 * One stylesheet for every printed document (claim stub, release slip).
 *
 * Plain CSS with physical units, not design tokens: these sheets must render
 * identically on any printer regardless of the app's theme, and a tint that
 * looks fine on screen prints as mud. Black on white, hairline rules only.
 *
 * The layout is a two-column band system, not a stack of full-width rows:
 * short values (a colour, one accessory, a two-word complaint) sit beside
 * each other instead of each claiming a line and leaving the right half of
 * the sheet empty.
 */
export const PRINT_CSS = `
.stub {
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #000;
  font-size: 8.5pt;
  line-height: 1.3;
  -webkit-font-smoothing: antialiased;
}
.stub .copy { padding-bottom: 1mm; }
.stub .copy--second {
  border-top: 1pt dashed #8a8a8a;
  margin-top: 4mm;
  padding-top: 4mm;
}

/* ── Masthead ─────────────────────────────────────────────────────── */
.stub .head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6mm;
  border-bottom: 1.5pt solid #000;
  padding-bottom: 1.8mm;
}
.stub .shop {
  font-size: 12pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}
.stub .fine {
  font-size: 7.5pt;
  color: #444;
  margin: 0.6mm 0 0;
}
.stub .copyLabel {
  font-size: 7.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
  margin: 0;
}

/* ── Identity band: number, code, QR — no dead space between them ── */
.stub .idBlock {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  column-gap: 8mm;
  padding: 3mm 0;
  border-bottom: 0.75pt solid #000;
}
.stub .label {
  font-size: 6.5pt;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #666;
  margin: 0 0 0.6mm;
}
.stub .ticketNo {
  font-family: ui-monospace, monospace;
  font-size: 13.5pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  white-space: nowrap;
}
.stub .claimBox {
  border: 1.5pt solid #000;
  padding: 1.6mm 3.4mm;
  text-align: center;
}
.stub .claimBox .label { color: #444; }
.stub .claimCode {
  font-family: ui-monospace, monospace;
  font-size: 16pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0;
  white-space: nowrap;
}
/* Anchored to the right edge by the 1fr spacer before it. */
.stub .qr { width: 18mm; height: 18mm; display: block; }

/* ── Detail grid: two label/value pairs per line ──────────────────── */
.stub .grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 6mm;
  margin: 0;
}
.stub .row {
  display: grid;
  grid-template-columns: 21mm 1fr;
  align-items: baseline;
  gap: 2mm;
  padding: 1.4mm 0;
  border-bottom: 0.5pt solid #e2e2e2;
  min-width: 0;
}
.stub .row dt {
  font-size: 7.5pt;
  color: #666;
  margin: 0;
}
.stub .row dd {
  font-size: 8.5pt;
  font-weight: 600;
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

/* ── Free-text blocks, paired so neither wastes a half-width ─────── */
.stub .blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 6mm;
  margin-top: 2.6mm;
}
.stub .block { min-width: 0; }
.stub .block--wide { grid-column: 1 / -1; }
.stub .body {
  font-size: 8.5pt;
  margin: 0;
  overflow-wrap: anywhere;
}

/* ── Money: the balance is the number that matters ───────────────── */
.stub .money {
  width: 100%;
  margin-top: 3mm;
  border-collapse: collapse;
}
.stub .money td {
  font-size: 8.5pt;
  padding: 1.2mm 0;
  border-bottom: 0.5pt solid #e2e2e2;
  color: #333;
}
.stub .money td:last-child {
  text-align: right;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}
.stub .money .due td {
  font-weight: 700;
  font-size: 10.5pt;
  color: #000;
  border-top: 1pt solid #000;
  border-bottom: none;
  padding-top: 1.4mm;
}

.stub .terms {
  font-size: 7pt;
  color: #444;
  line-height: 1.32;
  margin: 2.6mm 0 0;
}

/* ── Signatures: real room to actually sign ──────────────────────── */
.stub .sign {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12mm;
  margin-top: 5mm;
}
.stub .sign span {
  border-top: 0.75pt solid #000;
  padding-top: 1mm;
  font-size: 7pt;
  color: #666;
}

@media print {
  /* Neither copy may split across a page, and the pair must not be pushed
     onto a second sheet.

     Deliberately no fixed height: pinning each copy to half the sheet made
     the pair taller than what Chrome would fit alongside break-inside:avoid,
     and it broke them onto separate pages. The copies flow naturally instead,
     and only the one variable-length field is capped — that is what actually
     decides whether the pair fits. */
  .stub .copy { break-inside: avoid; }
  .stub .copy--second { break-before: avoid; }
  /* Free text is the only thing that can overrun the sheet, so it is the
     only thing capped. */
  .stub .problem {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
`;
