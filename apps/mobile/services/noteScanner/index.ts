/**
 * Note Scanner — on-device OCR to inspection form pre-fill.
 */
export { parseNoteText } from "./noteParser";
export type {
  Confidence,
  ParsedField,
  ParsedInspection,
  ScanResult,
} from "./types";

import type { FormState } from "../../app/(tabs)/(home)/inspection/fields";
import type { ParsedInspection } from "./types";

// ─── Template-level fields ───────────────────────────────────────────────────

const INTERMEDIATE_FIELDS: (keyof ParsedInspection)[] = [
  "larvaeSeen",
  "cappedBrood",
  "broodPatternScore",
  "framesOfBees",
  "framesOfBrood",
  "pollenStores",
  "pestSigns",
];

const ADVANCED_FIELDS: (keyof ParsedInspection)[] = [
  "numSupers",
  "diseaseSigns",
  "varroaCount",
];

/** Determine the minimum template level needed to display all parsed fields. */
function inferTemplateLevel(
  parsed: ParsedInspection,
): FormState["template"] {
  if (ADVANCED_FIELDS.some((f) => parsed[f] !== undefined)) return "Advanced";
  if (INTERMEDIATE_FIELDS.some((f) => parsed[f] !== undefined))
    return "Intermediate";
  return "Beginner";
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

/** Convert ParsedInspection to a partial FormState for pre-filling the form. */
export function mapParsedToFormState(
  parsed: ParsedInspection,
): Partial<FormState> {
  const state: Partial<FormState> = {};

  state.template = inferTemplateLevel(parsed);

  // Boolean fields
  if (parsed.queenSeen) state.queenSeen = parsed.queenSeen.value;
  if (parsed.eggsSeen) state.eggsSeen = parsed.eggsSeen.value;
  if (parsed.larvaeSeen) state.larvaeSeen = parsed.larvaeSeen.value;
  if (parsed.cappedBrood) state.cappedBrood = parsed.cappedBrood.value;
  if (parsed.attention) state.attention = parsed.attention.value;

  // Enum fields
  if (parsed.populationEstimate)
    state.populationEstimate = parsed.populationEstimate.value;
  if (parsed.honeyStores) state.honeyStores = parsed.honeyStores.value;
  if (parsed.temperament) state.temperament = parsed.temperament.value;
  if (parsed.pollenStores) state.pollenStores = parsed.pollenStores.value;
  if (parsed.conditions) state.conditions = parsed.conditions.value;

  // Number fields
  if (parsed.broodPatternScore)
    state.broodPatternScore = parsed.broodPatternScore.value;
  if (parsed.framesOfBees) state.framesOfBees = parsed.framesOfBees.value;
  if (parsed.framesOfBrood) state.framesOfBrood = parsed.framesOfBrood.value;
  if (parsed.numSupers) state.numSupers = parsed.numSupers.value;
  if (parsed.varroaCount) state.varroaCount = parsed.varroaCount.value;
  if (parsed.impression) state.impression = parsed.impression.value;
  if (parsed.durationMinutes)
    state.durationMinutes = parsed.durationMinutes.value;

  // Temperature stored as string in the form
  if (parsed.tempC) state.tempC = String(parsed.tempC.value);
  if (parsed.humidityPercent)
    state.humidityPercent = String(parsed.humidityPercent.value);

  // Multi-select arrays
  if (parsed.pestSigns) state.pestSigns = parsed.pestSigns.value;
  if (parsed.diseaseSigns) state.diseaseSigns = parsed.diseaseSigns.value;

  // Notes (unparsed text)
  if (parsed.notes) state.notes = parsed.notes;

  return state;
}

/** Count how many fields were successfully parsed. */
export function countParsedFields(parsed: ParsedInspection): number {
  let count = 0;
  for (const [key, val] of Object.entries(parsed)) {
    if (key === "notes") continue;
    if (val !== undefined) count++;
  }
  return count;
}
