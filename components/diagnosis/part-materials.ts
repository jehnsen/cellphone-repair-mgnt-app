import type { DevicePart, PartCategory } from "@/lib/types";

/**
 * What each part is *made of*, and what shape it takes.
 *
 * The catalog carries position, size, and explode vector — geometry as a row,
 * which is what keeps adding a part a seeder change rather than a deploy. It
 * deliberately does not carry appearance: a glass front and an aluminium frame
 * are the same box to the server, and they should be, because the server's job
 * is where the part sits and not what it looks like under a light.
 *
 * So finish is derived here, on the client, from the category the row already
 * has plus its key. Category does most of the work; the key only breaks ties
 * that matter visually — a camera *lens* is a glass cylinder while the camera
 * *module* behind it is a plastic block, and both arrive as `category: camera`.
 *
 * Everything below is presentation only. Nothing here can change which part is
 * implicated, which one is highlighted, or what the technician is told — those
 * come from the finding, and a material must never be able to imply a
 * diagnosis. In particular no finish carries hue: the graphite ramp in
 * `palette.ts` still sets the colour, and `--stamp` on the faulty part stays
 * the only real colour in the scene.
 */

/** How a part is drawn. */
export type PartShape =
  /** A slab with softened corners — the default, and most of the rig. */
  | "rounded"
  /** A disc seen edge-on: lens barrels, the earpiece, the vibration motor. */
  | "cylinder"
  /** A thin plate with a pronounced chamfer — glass, back cover, mid-frame. */
  | "plate";

export interface PartFinish {
  shape: PartShape;
  /** 0 mirror, 1 chalk. */
  roughness: number;
  metalness: number;
  /** Corner radius as a fraction of the part's smallest dimension. */
  round: number;
  /**
   * Clearcoat — the lacquered layer over a surface: glass, painted aluminium,
   * the gloss on a camera lens. It is what makes a highlight sit *on* a
   * surface instead of in it, and it is most of the difference between "a grey
   * box" and "a piece of a phone".
   */
  clearcoat: number;
  clearcoatRoughness: number;
  /**
   * A slight lightening of the base tone, for surfaces that really are lighter
   * than their neighbours (glass, brushed metal). Multiplied onto the
   * category tone, so it rides *with* the value ramp rather than fighting it.
   */
  tint: number;
}

/* Finishes are named after the real material, because that is how the shop
   talks about them and how a future reader will recognise the intent. */
const GLASS: PartFinish = {
  shape: "plate",
  roughness: 0.06,
  metalness: 0.12,
  round: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  tint: 1.18,
};

const ALUMINIUM: PartFinish = {
  shape: "rounded",
  roughness: 0.28,
  metalness: 0.85,
  round: 0.42,
  clearcoat: 0.35,
  clearcoatRoughness: 0.25,
  tint: 1.08,
};

/** The board: matte solder mask, no shine, faintly rough. */
const PCB: PartFinish = {
  shape: "rounded",
  roughness: 0.72,
  metalness: 0.22,
  round: 0.16,
  clearcoat: 0.1,
  clearcoatRoughness: 0.6,
  tint: 0.94,
};

/** A cell in a soft pouch — matte, slightly waxy, generously radiused. */
const BATTERY: PartFinish = {
  shape: "rounded",
  roughness: 0.55,
  metalness: 0.35,
  round: 0.34,
  clearcoat: 0.22,
  clearcoatRoughness: 0.4,
  tint: 1.02,
};

/** Injection-moulded plastic: modules, housings, buttons. */
const PLASTIC: PartFinish = {
  shape: "rounded",
  roughness: 0.62,
  metalness: 0.05,
  round: 0.3,
  clearcoat: 0.3,
  clearcoatRoughness: 0.35,
  tint: 0.98,
};

/** A lens: a glass disc, the shiniest thing on the device. */
const LENS: PartFinish = {
  shape: "cylinder",
  roughness: 0.03,
  metalness: 0.3,
  round: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  tint: 0.9,
};

/**
 * Perforated metal — a speaker or earpiece mesh.
 *
 * A slot, not a disc. This was a cylinder in the first pass and it was wrong
 * in a way only the exploded view showed: an earpiece is 14mm wide and 3mm
 * tall, so spinning it around its thinnest axis produced a flat ellipse
 * floating beside the phone. A speaker grille is a rounded slot, and the
 * generous radius here is what gives it its stadium shape.
 */
const MESH: PartFinish = {
  shape: "rounded",
  roughness: 0.68,
  metalness: 0.6,
  round: 0.48,
  clearcoat: 0.15,
  clearcoatRoughness: 0.5,
  tint: 0.95,
};

/** Kapton film — a ribbon cable. Thin, faintly translucent, low sheen. */
const FLEX: PartFinish = {
  shape: "plate",
  roughness: 0.48,
  metalness: 0.18,
  round: 0.45,
  clearcoat: 0.4,
  clearcoatRoughness: 0.3,
  tint: 1,
};

const BY_CATEGORY: Record<PartCategory, PartFinish> = {
  display: GLASS,
  structural: ALUMINIUM,
  board: PCB,
  power: BATTERY,
  camera: PLASTIC,
  audio: MESH,
  connectivity: FLEX,
};

/**
 * Key fragments that override the category default, most specific first.
 *
 * Matched as substrings rather than exact keys on purpose: the seeder owns the
 * vocabulary and will grow it, so `camera_rear_lens` and `rear_camera_lens`
 * both have to land on glass without this file being edited again. A key that
 * matches nothing falls through to its category, which is always a reasonable
 * answer — this list only sharpens, it is never load-bearing.
 */
const BY_KEY: Array<[fragment: string, finish: PartFinish]> = [
  ["lens", LENS],
  ["glass", GLASS],
  ["digitizer", GLASS],
  ["screen", GLASS],
  ["lcd", GLASS],
  ["oled", GLASS],
  ["display", GLASS],
  ["back_cover", GLASS],
  ["rear_cover", GLASS],
  ["battery", BATTERY],
  ["logic", PCB],
  ["board", PCB],
  ["motherboard", PCB],
  ["chip", PCB],
  ["ic", PCB],
  ["frame", ALUMINIUM],
  ["chassis", ALUMINIUM],
  ["bracket", ALUMINIUM],
  ["shield", ALUMINIUM],
  ["button", ALUMINIUM],
  ["sim", ALUMINIUM],
  ["speaker", MESH],
  ["earpiece", MESH],
  ["mic", MESH],
  ["grille", MESH],
  ["flex", FLEX],
  ["cable", FLEX],
  ["ribbon", FLEX],
  ["antenna", FLEX],
  ["port", PLASTIC],
  ["taptic", PLASTIC],
  ["vibrat", PLASTIC],
  ["motor", PLASTIC],
];

export function finishFor(part: DevicePart): PartFinish {
  const key = part.key.toLowerCase();

  for (const [fragment, finish] of BY_KEY) {
    if (key.includes(fragment)) return finish;
  }

  return BY_CATEGORY[part.category] ?? PLASTIC;
}

/**
 * Which axis a lens barrel runs along.
 *
 * Only lenses are cylinders now, and a lens is a short barrel pointing the way
 * it looks — which is the axis it is *thinnest* through, because a camera is
 * wider than it is deep. So the thin axis is the barrel's axis.
 *
 * Nothing else uses this. A speaker slot is emphatically not a cylinder: it is
 * wide and shallow, and spinning it around its thin axis turns it into a flat
 * ellipse. That is not hypothetical — it is what the exploded view showed
 * before `MESH` was moved back to a rounded slot.
 */
export function cylinderAxis(part: DevicePart): "x" | "y" | "z" {
  const { x, y, z } = part.size;
  if (z <= x && z <= y) return "z";
  if (x <= y) return "x";
  return "y";
}
