/**
 * Pure-function parser: converts OCR text lines into structured inspection data.
 * No side effects, no async — fully unit-testable.
 */
import type { Confidence, ParsedField, ParsedInspection } from "./types";
import {
  BOOLEAN_FALSE,
  BOOLEAN_TRUE,
  DATE_KEYWORDS,
  DISEASE_KEYWORDS,
  FIELD_PATTERNS,
  PEST_KEYWORDS,
  type FieldPattern,
} from "./synonyms";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip leading bullets, dashes, numbering, and whitespace. */
function normalizeLine(raw: string): string {
  return raw
    .trim()
    .replace(/^[\s\-•*#\d.)]+\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Split a line into key and value parts.
 * Tries `:`, `=`, then ` - ` (spaced dash) as delimiters.
 * Returns [key, value] or [fullLine, ""] if no delimiter found.
 */
function splitKeyValue(line: string): [string, string] {
  for (const delim of [":", "=", " - "]) {
    const idx = line.indexOf(delim);
    if (idx > 0) {
      return [line.slice(0, idx).trim(), line.slice(idx + delim.length).trim()];
    }
  }
  return [line.trim(), ""];
}

/** Check if a value string indicates boolean true. */
function parseBoolean(value: string): boolean | null {
  const v = value.toLowerCase().trim();
  if (BOOLEAN_TRUE.some((t) => v === t || v.startsWith(t))) return true;
  if (BOOLEAN_FALSE.some((f) => v === f || v.startsWith(f))) return false;
  return null;
}

/** Extract first numeric value from a string. Handles "4/5", "72F", "65%". */
function extractNumber(value: string): number | null {
  const slashMatch = value.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (slashMatch) return Number(slashMatch[1]);

  const cleaned = value.replace(/[%°fFcC]|mins?$/gi, "").trim();
  const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return Number(numMatch[1]);

  return null;
}

/** Match an enum value against a synonym map. Returns the canonical key or null. */
function matchEnum(
  value: string,
  enumValues: Record<string, string[]>,
): string | null {
  const v = value.toLowerCase().trim();
  for (const [canonical, synonyms] of Object.entries(enumValues)) {
    if (synonyms.some((syn) => v === syn || v.includes(syn))) return canonical;
  }
  return null;
}

/** Determine confidence based on how cleanly the extraction matched. */
function assessConfidence(exactKeyword: boolean): Confidence {
  return exactKeyword ? "high" : "medium";
}

/** Check if the key part contains any of the pattern's keywords. */
function matchesKeywords(key: string, pattern: FieldPattern): string | null {
  const sorted = [...pattern.keywords].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    if (key === kw || key.includes(kw)) return kw;
  }
  return null;
}

/**
 * Detect temperature and convert Fahrenheit to Celsius if needed.
 * Heuristic: if value contains "f" or number > 50, assume Fahrenheit.
 */
function parseTemperature(value: string): number | null {
  const num = extractNumber(value);
  if (num === null) return null;

  const isFahrenheit = /f/i.test(value) || (num > 50 && !/c/i.test(value));
  return isFahrenheit ? Math.round(((num - 32) * 5) / 9) : num;
}

/** Try to parse a date from a value string. Returns ISO date string or null. */
function parseDate(value: string): string | null {
  const mdyMatch = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    const date = new Date(`${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  }

  const textMatch = value.match(/([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i);
  if (textMatch) {
    const [, month, day, year] = textMatch;
    const dateStr = year
      ? `${month} ${day}, ${year}`
      : `${month} ${day}, ${new Date().getFullYear()}`;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  }

  return null;
}

// ─── Value extraction per type ───────────────────────────────────────────────

/** Extract a typed value from a string based on the field pattern's type. */
function extractValue(
  value: string,
  pattern: FieldPattern,
): { extracted: any } | null {
  if (!value) return null;

  switch (pattern.type) {
    case "boolean": {
      const b = parseBoolean(value);
      return b !== null ? { extracted: b } : null;
    }
    case "enum": {
      if (!pattern.values) return null;
      const e = matchEnum(value, pattern.values);
      return e ? { extracted: e } : null;
    }
    case "number": {
      const n = extractNumber(value);
      return n !== null ? { extracted: n } : null;
    }
    case "rating": {
      const r = extractNumber(value);
      if (r === null) return null;
      const clamped = Math.min(Math.max(r, pattern.min ?? 1), pattern.max ?? 5);
      return { extracted: clamped };
    }
    case "temperature": {
      const t = parseTemperature(value);
      return t !== null ? { extracted: t } : null;
    }
  }
}

// ─── Line matching ───────────────────────────────────────────────────────────

/** Try to match a single line against all unset field patterns. */
function matchLineToField(
  key: string,
  value: string,
  sourceLine: string,
  result: ParsedInspection,
): string | null {
  for (const pattern of FIELD_PATTERNS) {
    if (result[pattern.field as keyof ParsedInspection] !== undefined) continue;

    const matchedKw = matchesKeywords(key, pattern);
    if (!matchedKw) continue;

    const extracted = extractValue(value, pattern);
    if (!extracted) continue;

    const confidence = assessConfidence(key === matchedKw);
    (result as any)[pattern.field] = {
      value: extracted.extracted,
      confidence,
      sourceText: sourceLine,
    } satisfies ParsedField<any>;

    return pattern.field;
  }
  return null;
}

// ─── Pest/disease scanning ───────────────────────────────────────────────────

function detectKeywordsInText(
  text: string,
  keywordMap: Record<string, string[]>,
  alreadyDetected: string[],
): string | null {
  for (const [name, keywords] of Object.entries(keywordMap)) {
    if (alreadyDetected.includes(name)) continue;
    if (keywords.some((kw) => text.includes(kw))) return name;
  }
  return null;
}

function scanForPestsAndDiseases(
  allText: string[],
  rawLines: string[],
  result: ParsedInspection,
): void {
  const pests: string[] = [];
  const diseases: string[] = [];
  const pestSources: string[] = [];
  const diseaseSources: string[] = [];

  for (let i = 0; i < allText.length; i++) {
    const pest = detectKeywordsInText(allText[i], PEST_KEYWORDS, pests);
    if (pest) {
      pests.push(pest);
      pestSources.push(rawLines[i]);
    }

    const disease = detectKeywordsInText(allText[i], DISEASE_KEYWORDS, diseases);
    if (disease) {
      diseases.push(disease);
      diseaseSources.push(rawLines[i]);
    }
  }

  if (pests.length > 0) {
    result.pestSigns = {
      value: pests,
      confidence: "medium",
      sourceText: pestSources.join("; "),
    };
  }

  if (diseases.length > 0) {
    result.diseaseSigns = {
      value: diseases,
      confidence: "medium",
      sourceText: diseaseSources.join("; "),
    };
  }
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse OCR text lines into structured inspection data.
 * Lines that don't match any field are collected into `notes`.
 */
export function parseNoteText(lines: string[]): ParsedInspection {
  const result: ParsedInspection = {};
  const consumed = new Set<number>();
  const allText = lines.map(normalizeLine);

  // Pass 1: Match key-value lines against field patterns
  for (let i = 0; i < allText.length; i++) {
    const normalized = allText[i];
    if (!normalized) continue;

    const [key, value] = splitKeyValue(normalized);

    if (tryMatchDate(key, value, lines[i], result)) {
      consumed.add(i);
      continue;
    }

    const matched = matchLineToField(key, value, lines[i], result);
    if (matched) consumed.add(i);
  }

  // Pass 2: Scan all text for pest/disease mentions in prose
  scanForPestsAndDiseases(allText, lines, result);

  // Pass 3: Collect unconsumed lines as notes
  const leftover = lines
    .filter((_, i) => !consumed.has(i))
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (leftover.length > 0) {
    result.notes = leftover.join("\n");
  }

  return result;
}

function tryMatchDate(
  key: string,
  value: string,
  sourceLine: string,
  result: ParsedInspection,
): boolean {
  if (!value || !DATE_KEYWORDS.some((dk) => key.includes(dk))) return false;
  const dateStr = parseDate(value);
  if (!dateStr) return false;
  result.inspectedAt = { value: dateStr, confidence: "high", sourceText: sourceLine };
  return true;
}
