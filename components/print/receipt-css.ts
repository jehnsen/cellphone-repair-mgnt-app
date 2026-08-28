/**
 * The receipt roll.
 *
 * A thermal receipt is not a small A4 page: it is a fixed-width strip of
 * unknown length, printed at low resolution on paper that smears. So this is
 * mono-spaced, black on white, hairline-free except for dashed separators
 * (solid rules print as thick black bands on cheap thermal heads), and every
 * measurement is in millimetres against the physical roll.
 *
 * Width is set by the caller — 58mm and 80mm are the two rolls Philippine
 * counter printers use.
 *
 * The paper *size* (`@page { size: 80mm auto }`) is NOT set here: a `@page`
 * size descriptor is only honoured from a stylesheet present when the
 * document is parsed, and this string is injected at render time into a
 * `<style>` deep in `<body>`. So the roll page lives in `globals.css` as a
 * named `@page receipt`, claimed by `.receipt { page: receipt }`. What this
 * file owns is everything that *does* work from an inline sheet: the fixed
 * content width (so the money column never runs off the edge), the mono
 * type, the dashed rules, and the no-break rules.
 */
export const receiptCss = (widthMm: 58 | 80) => `
.receipt {
  font-family: ui-monospace, "Cascadia Mono", "Courier New", monospace;
  width: ${widthMm - 8}mm;
  max-width: ${widthMm - 8}mm;
  margin: 0 auto;
  color: #000;
  background: #fff;
  font-size: ${widthMm === 58 ? "7pt" : "8pt"};
  line-height: 1.35;
  -webkit-font-smoothing: none;
}

.receipt p,
.receipt h1 {
  margin: 0;
}

.receipt .center { text-align: center; }
.receipt .right { text-align: right; }
.receipt .bold { font-weight: 700; }

.receipt .shop {
  font-size: ${widthMm === 58 ? "9pt" : "10.5pt"};
  font-weight: 700;
  letter-spacing: -0.01em;
}

.receipt .fine {
  font-size: ${widthMm === 58 ? "6pt" : "6.5pt"};
  line-height: 1.3;
}

/* Dashed, never solid: a solid rule prints as a smeared band. */
.receipt .rule {
  border-top: 1px dashed #000;
  margin: 1.6mm 0;
}

.receipt .kind {
  font-size: ${widthMm === 58 ? "7pt" : "7.5pt"};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Meta and money share one two-column grid so the columns line up down the
   whole strip — the thing that makes a receipt readable at a glance. */
.receipt .row {
  display: flex;
  justify-content: space-between;
  gap: 2mm;
}
.receipt .row > span:last-child {
  white-space: nowrap;
}

.receipt .item {
  margin-top: 1.2mm;
}
.receipt .item .name {
  overflow-wrap: anywhere;
}
.receipt .item .qty {
  font-size: ${widthMm === 58 ? "6.5pt" : "7pt"};
}

.receipt .total {
  font-size: ${widthMm === 58 ? "8.5pt" : "10pt"};
  font-weight: 700;
}

.receipt .foot {
  margin-top: 2mm;
  font-size: ${widthMm === 58 ? "6pt" : "6.5pt"};
  line-height: 1.35;
}

@media print {
  .receipt {
    /* Hold the roll width — never fall back to \`auto\`, or the flex rows
       stretch to the sheet and \`space-between\` throws the values off the
       right edge (the bug this file exists to prevent). */
    width: ${widthMm - 8}mm;
    max-width: ${widthMm - 8}mm;
    margin: 0;
  }

  /* A receipt is one continuous strip; nothing in it may break. */
  .receipt .item,
  .receipt .totals {
    break-inside: avoid;
  }
}
`;
