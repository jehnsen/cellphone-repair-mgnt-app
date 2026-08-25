import { STATUS_META, type Aging } from "@/lib/status";
import { AgingStrip } from "@/components/tag/aging-strip";
import { formatClaimCode, formatImei, peso } from "@/lib/format";

/**
 * The design system, rendered. Not a product screen — a reference page so the
 * palette, type, and the aging treatment can be checked in both themes and in
 * print preview without hunting through the app.
 */

const SWATCHES: { token: string; label: string; role: string; className: string }[] = [
  { token: "--ink", label: "Ink", role: "Text, full-weight rules", className: "bg-ink" },
  { token: "--paper", label: "Paper", role: "App canvas", className: "bg-paper" },
  { token: "--copy", label: "Copy", role: "Cards, inputs, print surfaces", className: "bg-copy" },
  { token: "--rule", label: "Rule", role: "Hairlines, field underlines", className: "bg-rule" },
  { token: "--bench", label: "Bench", role: "Primary action, focus ring", className: "bg-bench" },
  { token: "--stamp", label: "Stamp", role: "Overdue, destructive", className: "bg-stamp" },
  { token: "--flag", label: "Flag", role: "Due soon, low stock", className: "bg-flag" },
];

const TIERS: { aging: Aging; label: string; note: string }[] = [
  {
    aging: { tier: "fresh", daysLate: -4, dwellHours: 3, stalled: false, srLabel: "On time" },
    label: "Fresh",
    note: "Bare paper edge, normal column order",
  },
  {
    aging: { tier: "soon", daysLate: -1.4, dwellHours: 20, stalled: false, srLabel: "Due soon" },
    label: "Due soon",
    note: "3px flag edge",
  },
  {
    aging: { tier: "today", daysLate: -0.3, dwellHours: 30, stalled: true, srLabel: "Due today" },
    label: "Due today",
    note: "Flag edge with hatching",
  },
  {
    aging: { tier: "overdue", daysLate: 3, dwellHours: 90, stalled: true, srLabel: "Overdue by 3 days" },
    label: "Overdue",
    note: "6px stamp edge, card leaves its column",
  },
];

export default function Page() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="border-b border-rule pb-2">
        <h1 className="font-display text-base font-semibold text-ink">Design specimen</h1>
        <p className="text-sm text-ink-soft">
          Tokens, type, and the aging scale. Switch the theme in the strip above to
          check both palettes.
        </p>
      </div>

      <section>
        <h2 className="label-bin text-ink">Palette</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.token} className="border border-rule bg-copy">
              <div className={`h-12 border-b border-rule ${swatch.className}`} />
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-ink">{swatch.label}</p>
                <p className="mono text-[0.6875rem] text-ink-faint">{swatch.token}</p>
                <p className="mt-1 text-xs text-ink-soft">{swatch.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label-bin text-ink">Type</h2>
        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          <div className="border border-rule bg-copy p-3">
            <p className="label-pad">Display — Archivo</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              Ready for pickup
            </p>
            <p className="label-bin mt-2 text-ink-soft">In repair · 7 · oldest 4d</p>
          </div>
          <div className="border border-rule bg-copy p-3">
            <p className="label-pad">Body — IBM Plex Sans</p>
            <p className="mt-1 text-sm text-ink">
              Screen has black ink spreading from the corner. Customer approved the
              quote by Viber.
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {peso(2450)} · {peso(18420)} · {peso(999)}
            </p>
          </div>
          <div className="border border-rule bg-copy p-3">
            <p className="label-pad">Mono — IBM Plex Mono</p>
            <p className="mono mt-1 text-sm text-ink">JO-202608-0142</p>
            <p className="mono text-sm text-ink">{formatImei("356938035643809")}</p>
            <p className="mono text-sm text-ink">{formatClaimCode("R4K7Q2")}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="label-bin text-ink">Aging scale</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Hue is spent on urgency only. Every step pairs colour with width and
          pattern, and the overdue step also changes position on the board.
        </p>
        <div className="mt-2 divide-y divide-rule-soft border border-rule bg-copy">
          {TIERS.map((tier) => (
            <div key={tier.label} className="flex items-stretch gap-3">
              <AgingStrip aging={tier.aging} />
              <div className="flex flex-1 items-center justify-between py-2.5 pr-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{tier.label}</p>
                  <p className="text-xs text-ink-soft">{tier.note}</p>
                </div>
                <span className="mono text-xs text-ink-faint">{tier.aging.srLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label-bin text-ink">Status codes</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Status is carried by column position, a two-letter code, and fill
          weight — never by hue.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.values(STATUS_META)
            .sort((a, b) => a.order - b.order)
            .map((meta) => (
              <span
                key={meta.status}
                className={
                  meta.fill === "solid"
                    ? "flex items-center gap-1.5 border border-ink bg-ink px-2 py-1 text-xs text-paper"
                    : meta.fill === "tint"
                      ? "flex items-center gap-1.5 border border-rule bg-secondary px-2 py-1 text-xs text-ink"
                      : "flex items-center gap-1.5 border border-rule bg-copy px-2 py-1 text-xs text-ink-soft"
                }
              >
                <span className="mono font-semibold">{meta.code}</span>
                {meta.label}
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}
