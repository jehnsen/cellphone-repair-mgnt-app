import { nextStatuses, STATUS_META } from "@/lib/status";
import { daysBetween, dueLabel } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/lib/types";

/**
 * What the shop sees.
 *
 * The server keeps eleven statuses and a strict state machine. One person
 * doing intake, repair, and release does not think in eleven states — they
 * think in five questions:
 *
 *   Do I need to look at it?  Am I waiting on the customer?  Am I waiting on
 *   a part?  Am I fixing it?  Is it waiting to be picked up?
 *
 * So statuses fold into stages, and the board draws stages. Three folds are
 * deliberate:
 *
 *   - **QC disappears.** The person who fixed it is the person who tests it.
 *     Testing is the last step of repair, not a queue of its own; the "Ready
 *     to claim" action *is* the QC gate.
 *   - **Diagnosed and awaiting approval are one stage.** Both mean the same
 *     thing to the owner: the ball is in the customer's court.
 *   - **Unclaimed is not a stage.** A unit nobody has collected is still
 *     waiting to be claimed — it just got old. Hiding it in its own bucket
 *     moves it out of the column where the owner would chase it, so it stays
 *     in "Ready to claim" and the aging edge does the shouting.
 *
 * `STATUS_META` is untouched: it remains the server's vocabulary, used for the
 * timeline and anywhere an exact status matters.
 */

export type Stage =
  | "to_check"
  | "waiting_customer"
  | "waiting_parts"
  | "in_repair"
  | "ready"
  | "closed";

export interface StageMeta {
  stage: Stage;
  /** Two-letter code, same channel the cards already use. */
  code: string;
  label: string;
  /** What the owner is actually waiting on, in the column header. */
  hint: string;
  order: number;
  onBoard: boolean;
  fill: "outline" | "tint" | "solid";
  /**
   * Column wayfinding hue, keyed to the `--stage-*` tokens. Used only on the
   * column header (a left rule + faint header tint) — never on the cards,
   * where a red edge already means overdue. `null` for off-board stages.
   */
  accent: "check" | "wait-customer" | "wait-parts" | "repair" | "ready" | null;
  /** Server statuses that live in this stage. */
  statuses: TicketStatus[];
  /** Where a card dropped on this column lands. */
  entry: TicketStatus;
  /** Hours before the board calls a job in this stage stalled. */
  dwellLimitHours: number;
  /** The one button this stage offers, and where it lands. */
  primary?: { label: string; to: TicketStatus };
  /** Everything else, behind "Move to". */
  secondary?: { label: string; to: TicketStatus }[];
}

export const STAGE_META: Record<Stage, StageMeta> = {
  to_check: {
    stage: "to_check",
    code: "TC",
    label: "To check",
    hint: "Not looked at yet",
    order: 1,
    onBoard: true,
    fill: "outline",
    accent: "check",
    statuses: ["received"],
    entry: "received",
    dwellLimitHours: 8,
    primary: { label: "Quote the customer", to: "awaiting_approval" },
    secondary: [
      { label: "Skip the quote, start repair", to: "in_repair" },
      { label: "Can't be repaired", to: "unrepairable" },
    ],
  },
  waiting_customer: {
    stage: "waiting_customer",
    code: "WC",
    label: "Waiting for customer",
    hint: "Quoted — waiting on a yes or no",
    order: 2,
    onBoard: true,
    fill: "tint",
    accent: "wait-customer",
    statuses: ["diagnosed", "awaiting_approval"],
    entry: "awaiting_approval",
    dwellLimitHours: 24,
    primary: { label: "Customer approved", to: "in_repair" },
    secondary: [
      { label: "Need to order parts", to: "awaiting_parts" },
      { label: "Customer declined", to: "returned_as_is" },
    ],
  },
  waiting_parts: {
    stage: "waiting_parts",
    code: "WP",
    label: "Waiting for parts",
    hint: "Ordered — waiting on delivery",
    order: 3,
    onBoard: true,
    fill: "tint",
    accent: "wait-parts",
    statuses: ["awaiting_parts"],
    entry: "awaiting_parts",
    dwellLimitHours: 72,
    primary: { label: "Parts arrived", to: "in_repair" },
    secondary: [{ label: "Can't be repaired", to: "unrepairable" }],
  },
  in_repair: {
    stage: "in_repair",
    code: "IR",
    label: "In repair",
    hint: "On the bench",
    order: 4,
    onBoard: true,
    fill: "solid",
    accent: "repair",
    /* QC folded in: testing is the last step of the repair, not a queue. */
    statuses: ["in_repair", "qc"],
    entry: "in_repair",
    dwellLimitHours: 48,
    primary: { label: "Tested — ready to claim", to: "ready_for_pickup" },
    secondary: [
      { label: "Need to order parts", to: "awaiting_parts" },
      { label: "Can't be repaired", to: "unrepairable" },
    ],
  },
  ready: {
    stage: "ready",
    code: "RD",
    label: "Ready to claim",
    hint: "Fixed — waiting for pickup",
    order: 5,
    onBoard: true,
    fill: "solid",
    accent: "ready",
    /* Unclaimed sits here too: it is the same shelf, just older. */
    statuses: ["ready_for_pickup", "unclaimed"],
    entry: "ready_for_pickup",
    dwellLimitHours: 72,
    primary: { label: "Release unit", to: "released" },
  },
  closed: {
    stage: "closed",
    code: "CL",
    label: "Closed",
    hint: "Off the board",
    order: 6,
    onBoard: false,
    fill: "outline",
    accent: null,
    statuses: ["released", "unrepairable", "returned_as_is"],
    entry: "released",
    dwellLimitHours: Number.POSITIVE_INFINITY,
  },
};

export const BOARD_STAGES: Stage[] = Object.values(STAGE_META)
  .filter((meta) => meta.onBoard)
  .sort((a, b) => a.order - b.order)
  .map((meta) => meta.stage);

const STAGE_OF: Partial<Record<TicketStatus, Stage>> = Object.values(
  STAGE_META,
).reduce<Partial<Record<TicketStatus, Stage>>>((map, meta) => {
  for (const status of meta.statuses) map[status] = meta.stage;
  return map;
}, {});

export function stageOf(status: TicketStatus): Stage {
  return STAGE_OF[status] ?? "closed";
}

export function stageMetaOf(ticket: Ticket): StageMeta {
  return STAGE_META[stageOf(ticket.status)];
}

/**
 * The hops needed to get from one status to another, in server order.
 *
 * The UI offers a stage-level action — "Tested, ready to claim" — which may be
 * two moves server-side (in_repair → qc → ready_for_pickup). Breadth-first over
 * the same transition table the API enforces, so a single click never trips a
 * 409 INVALID_STATUS_TRANSITION.
 *
 * Returns an empty array when already there, or when no legal route exists.
 */
export function transitionPath(from: TicketStatus, to: TicketStatus): TicketStatus[] {
  if (from === to) return [];

  const queue: TicketStatus[][] = [[from]];
  const seen = new Set<TicketStatus>([from]);

  while (queue.length) {
    const path = queue.shift()!;
    const tail = path[path.length - 1]!;

    for (const next of nextStatuses(tail)) {
      if (seen.has(next)) continue;
      const extended = [...path, next];
      if (next === to) return extended.slice(1);
      seen.add(next);
      queue.push(extended);
    }
  }

  return [];
}

/** Can this ticket reach that status at all, however many hops it takes? */
export function canReach(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || transitionPath(from, to).length > 0;
}

/** The moves a stage offers on a given ticket, dropping any that are illegal. */
export function stageActions(ticket: Ticket): {
  primary?: { label: string; to: TicketStatus };
  secondary: { label: string; to: TicketStatus }[];
} {
  const meta = STAGE_META[stageOf(ticket.status)];
  const reachable = (move: { label: string; to: TicketStatus }) =>
    canReach(ticket.status, move.to);

  return {
    primary: meta.primary && reachable(meta.primary) ? meta.primary : undefined,
    secondary: (meta.secondary ?? []).filter(reachable),
  };
}

/** Exact server status, for the timeline and anywhere precision matters. */
export function statusLabelOf(status: TicketStatus): string {
  return STATUS_META[status].label;
}

/**
 * The moves the board offers on a selection, in workflow order.
 *
 * Deliberately not every status: `diagnosed` and `qc` are hops the client
 * walks on its own, never destinations a person picks. Release and ready-for-
 * pickup have their own buttons because each needs more than a status change.
 */
export const BOARD_MOVES: { to: TicketStatus; label: string }[] = [
  { to: "awaiting_approval", label: "Quoted — waiting for customer" },
  { to: "awaiting_parts", label: "Waiting for parts" },
  { to: "in_repair", label: "In repair" },
  { to: "unrepairable", label: "Can't be repaired" },
  { to: "returned_as_is", label: "Returned unrepaired" },
];

/** The friendly name for a move, falling back to the server's own label. */
export function moveLabel(to: TicketStatus): string {
  return BOARD_MOVES.find((move) => move.to === to)?.label ?? statusLabelOf(to);
}

/**
 * The short phrase a card shows for time.
 *
 * Before the unit is fixed that is the promise ("3d late"); after it is fixed
 * the promise is settled and what matters is how long it has sat on the shelf
 * ("waiting 5d"). Saying "76d late" about a finished repair blames the shop
 * for the customer not turning up.
 */
export function agingLabel(ticket: Ticket, now: Date = new Date()): string {
  if (stageOf(ticket.status) !== "ready") return dueLabel(ticket.promisedAt, now);

  const days = Math.round(daysBetween(ticket.statusChangedAt, now));
  if (days <= 0) return "ready today";
  return `waiting ${days}d`;
}
