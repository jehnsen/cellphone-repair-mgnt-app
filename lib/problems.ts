import type { ProblemTag } from "@/lib/types";

/**
 * The quick-pick chips on the intake form.
 *
 * This is domain vocabulary, not data: the same nine values the API validates
 * against in `StoreRepairTicketRequest`. Changing one here without changing it
 * there makes intake fail with a 422.
 */

export const PROBLEM_TAGS: ProblemTag[] = [
  "screen",
  "battery",
  "charging_port",
  "water_damage",
  "no_power",
  "software",
  "camera",
  "speaker",
  "board_level",
];

export const PROBLEM_LABEL: Record<ProblemTag, string> = {
  screen: "Screen",
  battery: "Battery",
  charging_port: "Charging port",
  water_damage: "Water damage",
  no_power: "No power",
  software: "Software",
  camera: "Camera",
  speaker: "Speaker",
  board_level: "Board-level",
};
