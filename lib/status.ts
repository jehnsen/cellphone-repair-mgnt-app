import type { Ticket, TicketStatus } from "@/lib/types";
import { daysBetween, hoursBetween } from "@/lib/format";

/**
 * Status metadata. Hue is deliberately absent here: on the board, colour is
 * spent on urgency (see `agingOf`), and status is carried by column position,
 * a two-letter mono code, and fill weight — three channels that survive
 * greyscale and a two-foot glance.
 */

export interface StatusMeta {
  status: TicketStatus;
  /** Two-letter code shown on cards and table rows. */
  code: string;
  label: string;
  /** Sentence a timeline entry can use. */
  pastTense: string;
  /** Board column order. Terminal states sit outside the flow. */
  order: number;
  /** Rendered as a board column. */
  onBoard: boolean;
  /** Nothing moves after this. */
  terminal: boolean;
  /** Fill weight — the second channel after position. */
  fill: "outline" | "tint" | "solid";
  /** Hours a ticket may sit here before the board calls it stalled. */
  dwellLimitHours: number;
  /** The one primary action the header offers in this status. */
  primaryAction?: { label: string; next: TicketStatus };
}

export const STATUS_META: Record<TicketStatus, StatusMeta> = {
  received: {
    status: "received",
    code: "RC",
    label: "Received",
    pastTense: "received the unit",
    order: 1,
    onBoard: true,
    terminal: false,
    fill: "outline",
    dwellLimitHours: 8,
    primaryAction: { label: "Mark diagnosed", next: "diagnosed" },
  },
  diagnosed: {
    status: "diagnosed",
    code: "DX",
    label: "Diagnosed",
    pastTense: "recorded a diagnosis",
    order: 2,
    onBoard: true,
    terminal: false,
    fill: "outline",
    dwellLimitHours: 12,
    primaryAction: { label: "Send quote", next: "awaiting_approval" },
  },
  awaiting_approval: {
    status: "awaiting_approval",
    code: "AA",
    label: "Awaiting approval",
    pastTense: "sent the quote",
    order: 3,
    onBoard: true,
    terminal: false,
    fill: "tint",
    dwellLimitHours: 24,
    primaryAction: { label: "Record reply", next: "in_repair" },
  },
  awaiting_parts: {
    status: "awaiting_parts",
    code: "AP",
    label: "Awaiting parts",
    pastTense: "put the job on parts hold",
    order: 4,
    onBoard: true,
    terminal: false,
    fill: "tint",
    dwellLimitHours: 72,
    primaryAction: { label: "Parts arrived", next: "in_repair" },
  },
  in_repair: {
    status: "in_repair",
    code: "IR",
    label: "In repair",
    pastTense: "started the repair",
    order: 5,
    onBoard: true,
    terminal: false,
    fill: "solid",
    dwellLimitHours: 48,
    primaryAction: { label: "Send to QC", next: "qc" },
  },
  qc: {
    status: "qc",
    code: "QC",
    label: "QC",
    pastTense: "moved the unit to QC",
    order: 6,
    onBoard: true,
    terminal: false,
    fill: "solid",
    dwellLimitHours: 8,
    primaryAction: { label: "Mark ready for pickup", next: "ready_for_pickup" },
  },
  ready_for_pickup: {
    status: "ready_for_pickup",
    code: "RP",
    label: "Ready for pickup",
    pastTense: "marked the unit ready",
    order: 7,
    onBoard: true,
    terminal: false,
    fill: "solid",
    dwellLimitHours: 72,
    primaryAction: { label: "Release unit", next: "released" },
  },
  released: {
    status: "released",
    code: "RL",
    label: "Released",
    pastTense: "released the unit",
    order: 8,
    onBoard: false,
    terminal: true,
    fill: "outline",
    dwellLimitHours: Number.POSITIVE_INFINITY,
  },
  unrepairable: {
    status: "unrepairable",
    code: "UR",
    label: "Unrepairable",
    pastTense: "declared the unit unrepairable",
    order: 9,
    onBoard: false,
    terminal: true,
    fill: "outline",
    dwellLimitHours: 72,
    primaryAction: { label: "Return as-is", next: "released" },
  },
  returned_as_is: {
    status: "returned_as_is",
    code: "RA",
    label: "Returned as-is",
    pastTense: "returned the unit unrepaired",
    order: 10,
    onBoard: false,
    terminal: true,
    fill: "outline",
    dwellLimitHours: Number.POSITIVE_INFINITY,
  },
  unclaimed: {
    status: "unclaimed",
    code: "UN",
    label: "Unclaimed",
    pastTense: "flagged the unit unclaimed",
    order: 11,
    onBoard: false,
    terminal: true,
    fill: "outline",
    dwellLimitHours: Number.POSITIVE_INFINITY,
  },
};

export const BOARD_STATUSES: TicketStatus[] = Object.values(STATUS_META)
  .filter((meta) => meta.onBoard)
  .sort((a, b) => a.order - b.order)
  .map((meta) => meta.status);

export const ALL_STATUSES: TicketStatus[] = Object.values(STATUS_META)
  .sort((a, b) => a.order - b.order)
  .map((meta) => meta.status);

export function statusLabel(status: TicketStatus): string {
  return STATUS_META[status].label;
}

/* ── Aging: the only thing on the board allowed to use colour ────────── */

export type AgingTier = "fresh" | "soon" | "today" | "overdue";

export interface Aging {
  tier: AgingTier;
  /** Positive when past the promised date. */
  daysLate: number;
  /** Hours in the current status. */
  dwellHours: number;
  /** Sat in this status past its limit, even if not yet past promised date. */
  stalled: boolean;
  /** What a screen reader announces, since colour carries meaning here. */
  srLabel: string;
}

export function agingOf(ticket: Ticket, now: Date = new Date()): Aging {
  const dwellHours = hoursBetween(ticket.statusChangedAt, now);
  const meta = STATUS_META[ticket.status];
  const stalled = dwellHours > meta.dwellLimitHours;
  const daysToPromise = daysBetween(now, ticket.promisedAt);
  const daysLate = -daysToPromise;

  if (meta.terminal) {
    return {
      tier: "fresh",
      daysLate,
      dwellHours,
      stalled: false,
      srLabel: meta.label,
    };
  }

  let tier: AgingTier;
  if (daysToPromise < -0.01) tier = "overdue";
  else if (daysToPromise < 1) tier = "today";
  else if (daysToPromise < 2 || stalled) tier = "soon";
  else tier = "fresh";

  if (stalled && tier === "fresh") tier = "soon";

  const srLabel =
    tier === "overdue"
      ? `Overdue by ${Math.max(1, Math.round(daysLate))} days`
      : tier === "today"
        ? "Due today"
        : stalled
          ? `Stalled in ${meta.label} for ${Math.round(dwellHours)} hours`
          : `On time, due in ${Math.round(daysToPromise)} days`;

  return { tier, daysLate, dwellHours, stalled, srLabel };
}

/** Board and table sort: latest first, always. Never drag order. */
export function byUrgency(a: Ticket, b: Ticket, now: Date = new Date()): number {
  return (
    new Date(a.promisedAt).getTime() - new Date(b.promisedAt).getTime() ||
    new Date(a.statusChangedAt).getTime() - new Date(b.statusChangedAt).getTime()
  );
}

/** Legal next statuses — the board and the detail header both use this. */
export function nextStatuses(status: TicketStatus): TicketStatus[] {
  switch (status) {
    case "received":
      return ["diagnosed", "unrepairable"];
    case "diagnosed":
      return ["awaiting_approval", "in_repair", "unrepairable"];
    case "awaiting_approval":
      return ["in_repair", "awaiting_parts", "returned_as_is"];
    case "awaiting_parts":
      return ["in_repair", "unrepairable"];
    case "in_repair":
      return ["qc", "awaiting_parts", "unrepairable"];
    case "qc":
      return ["ready_for_pickup", "in_repair"];
    case "ready_for_pickup":
      return ["released", "unclaimed"];
    case "unclaimed":
      return ["released"];
    case "unrepairable":
      return ["returned_as_is"];
    default:
      return [];
  }
}
