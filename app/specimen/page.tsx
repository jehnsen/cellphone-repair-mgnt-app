"use client";

import { Search } from "lucide-react";
import { STATUS_META, type Aging } from "@/lib/status";
import { AgingStrip } from "@/components/tag/aging-strip";
import { PageHeader } from "@/components/shell/page-header";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelList,
  PanelTitle,
} from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, InputMono } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableNumeric,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { TagHead } from "@/components/tag/tag-head";
import { StatusChip } from "@/components/tag/status-chip";
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
    aging: {
      tier: "overdue",
      daysLate: 3,
      dwellHours: 90,
      stalled: true,
      srLabel: "Overdue by 3 days",
    },
    label: "Overdue",
    note: "6px stamp edge, card leaves its column",
  },
];

export default function Page() {
  return (
    <div className="page space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Reference"
        title="Design specimen"
        description="Tokens, type, and the aging scale. Switch the theme in the strip above to check both palettes."
      />

      <section aria-labelledby="signature">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 id="signature" className="label-bin text-ink">The tag</h2>
          <p className="min-w-0 flex-1 truncate text-xs text-ink-soft">
            One object at three scales: board card, detail head, printed stub.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <TagHead
            ticketNo="JO-202608-0142"
            claimCode="R4K7Q2"
            aging={TIERS[0].aging}
            title="Grace Villanueva"
            subtitle="Apple iPhone 12 · Midnight · 128GB"
            meta={[
              { label: "Promised", value: "Aug 28, 2026" },
              { label: "Balance", value: <span className="mono">{peso(1850)}</span> },
              { label: "Technician", value: "Rhea B." },
            ]}
            actions={<Button size="sm">Mark diagnosed</Button>}
          />
          <TagHead
            ticketNo="JO-202608-0129"
            claimCode="M8TQ47"
            aging={TIERS[3].aging}
            title="Emmanuel Lim"
            subtitle="Samsung Galaxy S22 · Graphite"
            meta={[
              { label: "Promised", value: "Aug 22, 2026" },
              { label: "Balance", value: <span className="mono">{peso(5200)}</span> },
              { label: "Held for", value: "Parts from Raon" },
            ]}
            actions={<Button size="sm" variant="outline">Chase parts</Button>}
          />
        </div>
      </section>

      <Panel>
        <PanelHeader>
          <PanelTitle>Palette</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {SWATCHES.map((swatch) => (
            <div key={swatch.token} className="border border-rule bg-copy">
              <div className={`h-14 border-b border-rule ${swatch.className}`} />
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-ink">{swatch.label}</p>
                <p className="mono text-[0.6875rem] text-ink-faint">{swatch.token}</p>
                <p className="mt-1 text-xs leading-snug text-ink-soft">{swatch.role}</p>
              </div>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader>
            <PanelTitle>Display — Archivo</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="display-lg">Ready for pickup</p>
            <p className="label-bin mt-2.5 text-ink-soft">In repair · 7 · oldest 4d</p>
            <p className="label-pad mt-2">Customer name</p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Body — IBM Plex Sans</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink">
              Screen has black ink spreading from the corner. Customer approved the
              quote by Viber.
            </p>
            <p className="mt-2.5 text-sm font-semibold text-ink">
              {peso(2450)} · {peso(18420)} · {peso(999)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Tabular figures are on by default, so columns line up everywhere.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Mono — IBM Plex Mono</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-1">
            <p className="mono text-sm text-ink">JO-202608-0142</p>
            <p className="mono text-sm text-ink">{formatImei("356938035643809")}</p>
            <p className="mono text-sm text-ink">{formatClaimCode("R4K7Q2")}</p>
            <p className="mt-1.5 text-xs leading-snug text-ink-soft">
              Identifiers on screen, and every printed thermal layout.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Aging scale</PanelTitle>
        </PanelHeader>
        <PanelBody className="pb-0">
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            Hue is spent on urgency only. Every step pairs colour with width and
            pattern, and the overdue step also changes position on the board.
          </p>
        </PanelBody>
        <PanelList className="mt-3 border-t border-rule">
          {TIERS.map((tier) => (
            <li key={tier.label} className="flex items-stretch gap-3">
              <AgingStrip aging={tier.aging} />
              <div className="tap flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2.5 pr-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{tier.label}</p>
                  <p className="text-xs text-ink-soft">{tier.note}</p>
                </div>
                <span className="mono text-xs text-ink-faint">{tier.aging.srLabel}</span>
              </div>
            </li>
          ))}
        </PanelList>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Status codes</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            Status is carried by column position, a two-letter code, and fill
            weight — never by hue.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.values(STATUS_META)
              .sort((a, b) => a.order - b.order)
              .map((meta) => (
                <StatusChip key={meta.status} status={meta.status} />
              ))}
          </div>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Controls</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Release unit</Button>
              <Button variant="outline">Send quote</Button>
              <Button variant="secondary">Add part</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Void ticket</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg">F2 · Pay</Button>
              <Button size="sm" variant="outline">Reassign</Button>
              <Button size="xs" variant="outline">CSV</Button>
              <Button size="icon-sm" variant="outline" aria-label="Search">
                <Search aria-hidden />
              </Button>
              <Button disabled>Saving…</Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-rule-soft pt-3">
              <Badge variant="outline">Outline</Badge>
              <Badge variant="tint">Tint</Badge>
              <Badge variant="solid">Solid</Badge>
              <Badge variant="bench">Approved</Badge>
              <Badge variant="flag">Low stock</Badge>
              <Badge variant="stamp">Overdue</Badge>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Fields</PanelTitle>
          </PanelHeader>
          <PanelBody className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="spec-name" className="label-pad">Customer name</Label>
              <Input id="spec-name" placeholder="Juan dela Cruz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-imei" className="label-pad">IMEI or serial</Label>
              <InputMono id="spec-imei" placeholder="35 693803 564380 9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-bad" className="label-pad">Mobile number</Label>
              <Input id="spec-bad" defaultValue="0917" aria-invalid="true" />
              <p className="text-xs text-stamp-ink">
                Enter all 11 digits, starting with 09.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-off" className="label-pad">Locked field</Label>
              <Input id="spec-off" defaultValue="JO-202608-0142" disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="spec-note" className="label-pad">Reported problem</Label>
              <Textarea
                id="spec-note"
                placeholder="Nabagsak, basag ang screen pero gumagana pa raw."
              />
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelBody className="p-0">
          <Tabs defaultValue="table" className="w-full">
            <TabsList variant="line" className="px-3 sm:px-4">
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="states">States</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="pt-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { no: "JO-202608-0142", who: "Grace Villanueva", status: "in_repair", due: 1850 },
                    { no: "JO-202608-0138", who: "Emmanuel Lim", status: "awaiting_parts", due: 5200 },
                    { no: "JO-202608-0131", who: "Aileen Pascual", status: "ready_for_pickup", due: 0 },
                  ].map((row) => (
                    <TableRow key={row.no}>
                      <TableCell className="mono whitespace-nowrap">{row.no}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.who}</TableCell>
                      <TableCell>
                        <StatusChip status={row.status as never} />
                      </TableCell>
                      <TableNumeric>{peso(row.due)}</TableNumeric>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="states" className="space-y-3 p-3 sm:p-4">
              <ErrorState
                error={Object.assign(new Error("The shop server did not respond."), {
                  hint: "Check the connection and try again. Nothing was saved.",
                })}
                onRetry={() => {}}
              />
              <div className="border border-rule">
                <LoadingRows rows={3} />
              </div>
              <div className="border border-rule">
                <EmptyState
                  icon={Search}
                  title="No tickets match that search."
                  body="Try the claim code or the last four digits of the mobile number."
                  action={<Button size="sm" variant="outline">Clear filters</Button>}
                />
              </div>
            </TabsContent>
          </Tabs>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Elevation</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Panel", note: "Flat surfaces, separated by rules", className: "shadow-panel" },
            { label: "Raised", note: "Tooltips, sticky strip when scrolled", className: "shadow-raised" },
            { label: "Float", note: "Menus, sheets, dialogs", className: "shadow-float" },
          ].map((level) => (
            <div
              key={level.label}
              className={`border border-rule bg-copy p-3 ${level.className}`}
            >
              <p className="text-sm font-semibold text-ink">{level.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-ink-soft">{level.note}</p>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
