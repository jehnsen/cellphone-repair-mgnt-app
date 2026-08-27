import type { DefectArea, Resolution, RootCause } from "@/lib/types";

/**
 * Display labels for the findings vocabulary.
 *
 * The server enums are the source of truth (docs/backend-findings-spec.md);
 * these are only how the words read at the bench. Keep the key sets in step —
 * a value the server accepts but this file omits renders as a raw enum.
 */

export const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  drop_impact: "Drop / impact",
  liquid_ingress: "Liquid damage",
  component_wear: "Component wear",
  power_surge: "Power surge",
  third_party_repair: "Previous repair elsewhere",
  firmware_corruption: "Firmware / software",
  manufacturing_defect: "Manufacturing defect",
  user_error: "User error",
  no_fault_found: "No fault found",
  other: "Other",
};

export const DEFECT_LABEL: Record<DefectArea, string> = {
  screen: "Screen",
  digitizer: "Digitizer / touch",
  battery: "Battery",
  charging_port: "Charging port",
  motherboard: "Motherboard",
  power_ic: "Power IC",
  camera_rear: "Rear camera",
  camera_front: "Front camera",
  speaker: "Loudspeaker",
  earpiece: "Earpiece",
  microphone: "Microphone",
  buttons: "Buttons",
  back_cover: "Back cover",
  housing: "Housing / frame",
  sim_reader: "SIM reader",
  sd_reader: "SD reader",
  wifi_antenna: "Wi-Fi antenna",
  other: "Other",
};

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  repaired: "Repaired",
  part_replaced: "Part replaced",
  cleaned: "Cleaned / reseated",
  software_restored: "Software restored",
  no_fault_found: "No fault found",
  unrepairable: "Unrepairable",
  customer_declined: "Customer declined",
};

export const ROOT_CAUSES = Object.keys(ROOT_CAUSE_LABEL) as RootCause[];
export const DEFECT_AREAS = Object.keys(DEFECT_LABEL) as DefectArea[];
export const RESOLUTIONS = Object.keys(RESOLUTION_LABEL) as Resolution[];

/**
 * The two conditional-required rules the server enforces, mirrored here so a
 * technician is told at the bench rather than after pressing Save.
 * Returns a field-keyed map, empty when the draft is valid.
 */
export function validateFinding(draft: {
  summary: string;
  details: string;
  rootCause: RootCause | "";
  resolution: Resolution | "";
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (draft.summary.trim().length < 3) {
    errors.summary = "Say in a sentence what was wrong.";
  }
  if (!draft.rootCause) errors.rootCause = "Pick a root cause.";
  if (!draft.resolution) errors.resolution = "Pick what was done.";

  if (draft.rootCause === "other" && !draft.details.trim()) {
    errors.details = "Root cause “Other” needs an explanation.";
  }
  if (draft.resolution === "unrepairable" && !draft.details.trim()) {
    errors.details = "Say why it cannot be repaired — the customer is told this.";
  }

  return errors;
}
