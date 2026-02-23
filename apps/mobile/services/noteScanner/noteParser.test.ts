import { parseNoteText } from "./noteParser";
import { mapParsedToFormState, countParsedFields } from "./index";

// ─── Standard key-value pairs ────────────────────────────────────────────────

describe("parseNoteText", () => {
  it("parses standard key:value boolean fields", () => {
    const result = parseNoteText([
      "Queen Seen: Yes",
      "Eggs Seen: No",
    ]);
    expect(result.queenSeen?.value).toBe(true);
    expect(result.queenSeen?.confidence).toBe("high");
    expect(result.eggsSeen?.value).toBe(false);
  });

  it("parses abbreviated forms", () => {
    const result = parseNoteText(["QS: Y", "Eggs: N"]);
    expect(result.queenSeen?.value).toBe(true);
    expect(result.eggsSeen?.value).toBe(false);
  });

  it("parses enum fields with synonyms", () => {
    const result = parseNoteText([
      "Population: Strong",
      "Honey Stores: Adequate",
      "Temperament: Calm",
    ]);
    expect(result.populationEstimate?.value).toBe("strong");
    expect(result.honeyStores?.value).toBe("adequate");
    expect(result.temperament?.value).toBe("calm");
  });

  it("handles enum synonyms (good = adequate)", () => {
    const result = parseNoteText(["Honey: good"]);
    expect(result.honeyStores?.value).toBe("adequate");
  });

  it("parses number fields", () => {
    const result = parseNoteText([
      "Frames of Bees: 8",
      "Frames of Brood: 5",
      "Supers: 2",
    ]);
    expect(result.framesOfBees?.value).toBe(8);
    expect(result.framesOfBrood?.value).toBe(5);
    expect(result.numSupers?.value).toBe(2);
  });

  it("parses ratings with slash notation (4/5)", () => {
    const result = parseNoteText(["Brood Pattern: 4/5"]);
    expect(result.broodPatternScore?.value).toBe(4);
  });

  it("clamps ratings to min/max range", () => {
    const result = parseNoteText(["Impression: 7"]);
    expect(result.impression?.value).toBe(5);
  });

  it("parses varroa count with slash", () => {
    const result = parseNoteText(["Varroa: 2/100"]);
    expect(result.varroaCount?.value).toBe(2);
  });

  // ─── Temperature ─────────────────────────────────────────────────────────

  it("converts Fahrenheit to Celsius", () => {
    const result = parseNoteText(["Temp: 72F"]);
    expect(result.tempC?.value).toBe(22);
  });

  it("keeps Celsius values as-is", () => {
    const result = parseNoteText(["Temperature: 22C"]);
    expect(result.tempC?.value).toBe(22);
  });

  it("assumes Fahrenheit for values > 50 without unit", () => {
    const result = parseNoteText(["Temp: 80"]);
    expect(result.tempC?.value).toBe(27);
  });

  it("keeps values <= 50 as Celsius when no unit", () => {
    const result = parseNoteText(["Temp: 22"]);
    expect(result.tempC?.value).toBe(22);
  });

  // ─── Weather ─────────────────────────────────────────────────────────────

  it("parses weather conditions", () => {
    const result = parseNoteText([
      "Conditions: Sunny",
      "Humidity: 65%",
    ]);
    expect(result.conditions?.value).toBe("sunny");
    expect(result.humidityPercent?.value).toBe(65);
  });

  // ─── General fields ──────────────────────────────────────────────────────

  it("parses attention and duration", () => {
    const result = parseNoteText([
      "Needs Attention: Yes",
      "Duration: 30 mins",
    ]);
    expect(result.attention?.value).toBe(true);
    expect(result.durationMinutes?.value).toBe(30);
  });

  // ─── Date detection ──────────────────────────────────────────────────────

  it("parses MM/DD/YYYY date", () => {
    const result = parseNoteText(["Date: 2/15/2026"]);
    expect(result.inspectedAt?.value).toBe("2026-02-15");
  });

  it("parses date with dashes", () => {
    const result = parseNoteText(["Inspection Date: 02-15-2026"]);
    expect(result.inspectedAt?.value).toBe("2026-02-15");
  });

  // ─── Pest/disease detection ──────────────────────────────────────────────

  it("detects pests mentioned in prose", () => {
    const result = parseNoteText([
      "Noticed some wax moth in corner",
      "Also saw small hive beetle",
    ]);
    expect(result.pestSigns?.value).toContain("wax_moth");
    expect(result.pestSigns?.value).toContain("hive_beetle");
  });

  it("detects diseases by keyword", () => {
    const result = parseNoteText(["Signs of chalkbrood on frames"]);
    expect(result.diseaseSigns?.value).toContain("chalkbrood");
  });

  // ─── Notes / leftover text ───────────────────────────────────────────────

  it("collects unmatched lines as notes", () => {
    const result = parseNoteText([
      "Queen Seen: Yes",
      "Colony looks healthy, good build-up for spring",
      "Fed 1:1 syrup",
    ]);
    expect(result.queenSeen?.value).toBe(true);
    expect(result.notes).toContain("Colony looks healthy");
    expect(result.notes).toContain("Fed 1:1 syrup");
  });

  it("returns empty result for empty input", () => {
    const result = parseNoteText([]);
    expect(countParsedFields(result)).toBe(0);
    expect(result.notes).toBeUndefined();
  });

  it("handles all-garbage input gracefully", () => {
    const result = parseNoteText(["asdf jkl;", "xyzzy 123"]);
    expect(result.notes).toBeDefined();
    expect(countParsedFields(result)).toBe(0); // notes excluded from count
  });

  // ─── Mixed case and spacing ──────────────────────────────────────────────

  it("handles mixed case and extra spacing", () => {
    const result = parseNoteText(["  HONEY  STORES :  ADEQUATE  "]);
    expect(result.honeyStores?.value).toBe("adequate");
  });

  it("strips leading bullets and numbering", () => {
    const result = parseNoteText([
      "- Queen: Yes",
      "* Eggs: No",
      "1. Honey: Low",
    ]);
    expect(result.queenSeen?.value).toBe(true);
    expect(result.eggsSeen?.value).toBe(false);
    expect(result.honeyStores?.value).toBe("low");
  });

  // ─── Delimiter variants ──────────────────────────────────────────────────

  it("handles = delimiter", () => {
    const result = parseNoteText(["Queen Seen = Yes"]);
    expect(result.queenSeen?.value).toBe(true);
  });

  it("handles spaced dash delimiter", () => {
    const result = parseNoteText(["Temperament - Calm"]);
    expect(result.temperament?.value).toBe("calm");
  });

  // ─── First-match-wins ────────────────────────────────────────────────────

  it("uses first match when field appears twice", () => {
    const result = parseNoteText([
      "Queen Seen: Yes",
      "Queen: No",
    ]);
    expect(result.queenSeen?.value).toBe(true);
  });

  // ─── Comprehensive real-world scenario ───────────────────────────────────

  it("parses a full realistic note page", () => {
    const result = parseNoteText([
      "Date: 2/22/2026",
      "Queen Seen: Yes",
      "Eggs: Yes",
      "Larvae: Yes",
      "Capped Brood: Yes",
      "Population: Strong",
      "Honey Stores: Adequate",
      "Temperament: Calm",
      "Brood Pattern: 4/5",
      "Frames of Bees: 8",
      "Frames of Brood: 5",
      "Pollen: Adequate",
      "Supers: 2",
      "Varroa: 3",
      "Impression: 4/5",
      "Duration: 25 mins",
      "Temp: 72F",
      "Humidity: 60%",
      "Conditions: Sunny",
      "Needs Attention: No",
      "Nice colony, ready for spring buildup",
    ]);

    expect(result.inspectedAt?.value).toBe("2026-02-22");
    expect(result.queenSeen?.value).toBe(true);
    expect(result.eggsSeen?.value).toBe(true);
    expect(result.larvaeSeen?.value).toBe(true);
    expect(result.cappedBrood?.value).toBe(true);
    expect(result.populationEstimate?.value).toBe("strong");
    expect(result.honeyStores?.value).toBe("adequate");
    expect(result.temperament?.value).toBe("calm");
    expect(result.broodPatternScore?.value).toBe(4);
    expect(result.framesOfBees?.value).toBe(8);
    expect(result.framesOfBrood?.value).toBe(5);
    expect(result.pollenStores?.value).toBe("adequate");
    expect(result.numSupers?.value).toBe(2);
    expect(result.varroaCount?.value).toBe(3);
    expect(result.impression?.value).toBe(4);
    expect(result.durationMinutes?.value).toBe(25);
    expect(result.tempC?.value).toBe(22);
    expect(result.humidityPercent?.value).toBe(60);
    expect(result.conditions?.value).toBe("sunny");
    expect(result.attention?.value).toBe(false);
    expect(result.notes).toContain("Nice colony");
  });
});

// ─── mapParsedToFormState ────────────────────────────────────────────────────

describe("mapParsedToFormState", () => {
  it("maps parsed fields to FormState shape", () => {
    const parsed = parseNoteText([
      "Queen Seen: Yes",
      "Honey: Low",
      "Frames of Bees: 6",
      "Temp: 20C",
    ]);
    const state = mapParsedToFormState(parsed);

    expect(state.queenSeen).toBe(true);
    expect(state.honeyStores).toBe("low");
    expect(state.framesOfBees).toBe(6);
    expect(state.tempC).toBe("20");
    expect(state.template).toBe("Intermediate"); // framesOfBees is intermediate
  });

  it("promotes template to Intermediate for intermediate fields", () => {
    const parsed = parseNoteText([
      "Larvae: Yes",
      "Brood Pattern: 3/5",
    ]);
    const state = mapParsedToFormState(parsed);
    expect(state.template).toBe("Intermediate");
  });

  it("promotes template to Advanced for advanced fields", () => {
    const parsed = parseNoteText(["Varroa: 5"]);
    const state = mapParsedToFormState(parsed);
    expect(state.template).toBe("Advanced");
  });
});
