import type {
  DevicePart,
  DiagnosisIssue,
  IssueCatalog,
  IssueSource,
  PartCategory,
  RepairFinding,
  Ticket,
} from "@/lib/types";

/**
 * The domain rules behind the diagnosis visualizer, in one place — the scene
 * components only draw.
 *
 * The server owns the taxonomy and the issue-to-part mapping (`/issue-types`),
 * so nothing here hardcodes a second copy. What lives here is the reasoning
 * *around* it: which vocabulary describes a ticket right now, how a set of
 * issues resolves to parts, and how the scene is laid out.
 */

/* ── Which vocabulary is in play ────────────────────────────────────── */

export const SOURCE_LABEL: Record<IssueSource, string> = {
  problem_tag: "Reported at intake",
  defect: "Found at the bench",
};

export const SOURCE_BLURB: Record<IssueSource, string> = {
  problem_tag:
    "What the customer described at the counter. Replaced by the bench findings once the unit has been opened.",
  defect: "What the technician actually found, from this ticket's findings.",
};

/**
 * Which vocabulary describes this ticket, and what it currently says.
 *
 * A finding means somebody has had the unit open and said what it actually
 * is, so its defects win. Without one there is still the customer's own
 * account from intake, which is worth drawing — it is what they told the
 * counter, and seeing it is how they confirm the shop understood them.
 *
 * Mirrors PublicVerificationController::issuesFor on the server, which has to
 * make the same choice for the customer-facing link.
 */
export function issuesForTicket(
  ticket: Pick<Ticket, "problemTags">,
  finding: RepairFinding | null,
): { source: IssueSource; keys: string[] } {
  const defects = finding?.defects ?? [];

  if (defects.length > 0) {
    return { source: "defect", keys: [...defects] };
  }

  return { source: "problem_tag", keys: [...(ticket.problemTags ?? [])] };
}

/**
 * The parts a set of issue keys implicates, in the order the mapping gives —
 * rank 1 first, because that is the part the technician means and the one the
 * camera frames.
 *
 * De-duplicated across issues: "no power" and "battery" both name the battery,
 * and highlighting it twice is not more highlighted.
 */
export function partKeysForIssues(
  catalog: IssueCatalog,
  source: IssueSource,
  issueKeys: string[],
): string[] {
  const byKey = new Map(catalog[source].map((issue) => [issue.key, issue]));
  const keys: string[] = [];

  for (const issueKey of issueKeys) {
    for (const partKey of byKey.get(issueKey)?.partKeys ?? []) {
      if (!keys.includes(partKey)) keys.push(partKey);
    }
  }

  return keys;
}

/** The issues in a vocabulary that actually map to something, for the picker. */
export function issuesInSource(
  catalog: IssueCatalog,
  source: IssueSource,
): DiagnosisIssue[] {
  return catalog[source];
}

export function labelForIssue(
  catalog: IssueCatalog,
  source: IssueSource,
  key: string,
): string {
  return catalog[source].find((issue) => issue.key === key)?.label ?? key;
}

/* ── Parts ──────────────────────────────────────────────────────────── */

export const PART_CATEGORY_LABEL: Record<PartCategory, string> = {
  display: "Display",
  power: "Power",
  camera: "Camera",
  audio: "Audio",
  connectivity: "Connectivity",
  structural: "Structural",
  board: "Board",
};

export const PART_CATEGORIES = Object.keys(
  PART_CATEGORY_LABEL,
) as PartCategory[];

export function partsByKey(parts: DevicePart[]): Map<string, DevicePart> {
  return new Map(parts.map((part) => [part.key, part]));
}

/** Resolve keys to parts, dropping any the rig no longer carries. */
export function resolveParts(
  parts: DevicePart[],
  keys: string[],
): DevicePart[] {
  const byKey = partsByKey(parts);
  return keys
    .map((key) => byKey.get(key))
    .filter((part): part is DevicePart => part !== undefined);
}

/* ── The scene ──────────────────────────────────────────────────────── */

/**
 * Millimetres to world units.
 *
 * The catalog is in millimetres because that is how a phone is described; the
 * scene wants numbers near 1 so the camera, lights, and orbit distances read
 * sensibly. A nominal 150 mm handset becomes 3 units tall.
 */
export const SCENE_SCALE = 0.02;

/**
 * The framing a diagnosis opens at — a locked three-quarter view, slightly
 * above and to the right.
 *
 * Deliberately not the front-on view: a flat slab seen face-on gives no depth
 * cue at all, and the whole point is showing that a part sits *inside* the
 * device. Also deliberately fixed — this is used with a customer watching over
 * the technician's shoulder, and nobody should have to watch someone fumble
 * with orbit controls to see their own phone.
 */
export const DEFAULT_CAMERA: [number, number, number] = [2.7, 1.7, 4.4];

/** How far a highlighted part lifts clear of the chassis, as a fraction of
 *  its full explode distance. Enough to read as separate, not an explosion —
 *  diagnosis mode is "here is the one part", not a teardown. */
export const ISOLATION_LIFT = 0.16;

/* ── Capability ─────────────────────────────────────────────────────── */

/**
 * Whether this browser can render the scene at all.
 *
 * Shop tablets are old and kiosk browsers are stripped; a canvas that comes up
 * blank is worse than a list, because the technician does not find out until a
 * customer is already looking at it. Checked once, before mounting anything.
 */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}
