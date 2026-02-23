/**
 * Keyword synonym maps for parsing handwritten beekeeping inspection notes.
 * Each field has a list of keywords that OCR text is matched against,
 * plus value maps for enum/boolean extraction.
 */

// ─── Value type definitions ──────────────────────────────────────────────────

export type FieldType =
  | "boolean"
  | "enum"
  | "number"
  | "rating"
  | "temperature";

export interface FieldPattern {
  field: string;
  type: FieldType;
  keywords: string[];
  values?: Record<string, string[]>;
  min?: number;
  max?: number;
}

// ─── Boolean value maps ──────────────────────────────────────────────────────

export const BOOLEAN_TRUE = [
  "yes", "y", "true", "1", "seen", "present", "spotted",
  "confirmed", "positive", "checked", "x", "ok", "found",
];

export const BOOLEAN_FALSE = [
  "no", "n", "false", "0", "not seen", "absent", "none",
  "negative", "missing", "not found",
];

// ─── Field patterns ──────────────────────────────────────────────────────────

export const FIELD_PATTERNS: FieldPattern[] = [
  // ── Beginner observations ──
  {
    field: "queenSeen",
    type: "boolean",
    keywords: [
      "queen seen", "queen spotted", "queen present", "queen sighted",
      "queen", "qs", "q seen",
    ],
  },
  {
    field: "eggsSeen",
    type: "boolean",
    keywords: ["eggs seen", "eggs", "egg", "es", "eggs spotted"],
  },
  {
    field: "populationEstimate",
    type: "enum",
    keywords: [
      "population", "pop", "colony strength", "strength",
      "population estimate",
    ],
    values: {
      low: ["low", "weak", "light", "sparse", "few", "small"],
      medium: ["medium", "moderate", "average", "normal", "ok", "okay"],
      strong: ["strong", "high", "heavy", "lots", "booming", "packed", "big"],
    },
  },
  {
    field: "honeyStores",
    type: "enum",
    keywords: ["honey stores", "honey", "hs"],
    values: {
      empty: ["empty", "none", "0", "zero"],
      low: ["low", "light", "little", "some"],
      adequate: ["adequate", "good", "ok", "okay", "enough", "sufficient"],
      full: ["full", "heavy", "lots", "plenty", "abundant", "overflowing"],
    },
  },
  {
    field: "temperament",
    type: "enum",
    keywords: [
      "temperament", "temper", "behavior", "behaviour", "mood",
      "disposition",
    ],
    values: {
      calm: ["calm", "gentle", "docile", "quiet", "friendly", "easy"],
      nervous: [
        "nervous", "jittery", "uneasy", "restless", "anxious", "flighty",
      ],
      aggressive: [
        "aggressive", "hot", "angry", "mean", "defensive", "stingy",
      ],
    },
  },

  // ── Intermediate observations ──
  {
    field: "larvaeSeen",
    type: "boolean",
    keywords: ["larvae seen", "larvae", "larva", "ls", "larvae spotted"],
  },
  {
    field: "cappedBrood",
    type: "boolean",
    keywords: ["capped brood", "capped", "cb", "sealed brood"],
  },
  {
    field: "broodPatternScore",
    type: "rating",
    keywords: ["brood pattern", "brood score", "bp", "pattern score"],
    min: 1,
    max: 5,
  },
  {
    field: "framesOfBees",
    type: "number",
    keywords: ["frames of bees", "frames bees", "fob", "bee frames"],
  },
  {
    field: "framesOfBrood",
    type: "number",
    keywords: [
      "frames of brood", "frames brood", "brood frames", "fb",
    ],
  },
  {
    field: "pollenStores",
    type: "enum",
    keywords: ["pollen stores", "pollen", "ps"],
    values: {
      none: ["none", "empty", "0", "zero"],
      low: ["low", "little", "some", "light"],
      adequate: ["adequate", "good", "ok", "okay", "enough"],
      abundant: ["abundant", "lots", "plenty", "heavy", "full"],
    },
  },

  // ── Advanced observations ──
  {
    field: "numSupers",
    type: "number",
    keywords: ["supers", "num supers", "number of supers", "honey supers"],
  },
  {
    field: "varroaCount",
    type: "number",
    keywords: [
      "varroa count", "varroa", "mite count", "mites", "vc",
    ],
  },

  // ── General fields ──
  {
    field: "impression",
    type: "rating",
    keywords: ["impression", "overall", "score", "rating"],
    min: 1,
    max: 5,
  },
  {
    field: "attention",
    type: "boolean",
    keywords: [
      "attention", "needs attention", "urgent", "follow up",
      "action needed", "followup",
    ],
  },
  {
    field: "durationMinutes",
    type: "number",
    keywords: ["duration", "time spent", "minutes", "mins", "min"],
  },

  // ── Weather ──
  {
    field: "tempC",
    type: "temperature",
    keywords: ["temp", "temperature"],
  },
  {
    field: "humidityPercent",
    type: "number",
    keywords: ["humidity", "rh", "relative humidity"],
  },
  {
    field: "conditions",
    type: "enum",
    keywords: ["conditions", "weather", "sky"],
    values: {
      sunny: ["sunny", "clear", "bright", "sun"],
      partly_cloudy: ["partly cloudy", "partly", "scattered"],
      cloudy: ["cloudy", "overcast", "grey", "gray"],
      rainy: ["rainy", "rain", "wet", "drizzle", "showers"],
      windy: ["windy", "wind", "breezy", "gusty"],
    },
  },
];

// ─── Pest & disease keyword maps (multi-select, detected in prose) ───────────

export const PEST_KEYWORDS: Record<string, string[]> = {
  varroa: ["varroa", "mites", "mite"],
  wax_moth: ["wax moth", "waxmoth", "moth"],
  hive_beetle: ["hive beetle", "shb", "small hive beetle", "beetle"],
  ants: ["ants", "ant"],
};

export const DISEASE_KEYWORDS: Record<string, string[]> = {
  AFB: ["afb", "american foulbrood", "foulbrood"],
  EFB: ["efb", "european foulbrood"],
  nosema: ["nosema"],
  chalkbrood: ["chalkbrood", "chalk brood", "chalk"],
};

// ─── Date patterns ───────────────────────────────────────────────────────────

export const DATE_KEYWORDS = ["date", "inspected", "inspection date"];
