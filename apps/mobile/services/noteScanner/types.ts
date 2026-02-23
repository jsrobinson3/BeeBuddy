/**
 * Types for the Note Scanner feature — on-device OCR to inspection pre-fill.
 */

/** Confidence level of a parsed field (parsing certainty, not ML confidence). */
export type Confidence = "high" | "medium" | "low";

/** A single parsed value with metadata about how it was extracted. */
export interface ParsedField<T> {
  value: T;
  confidence: Confidence;
  /** The original OCR line that produced this extraction. */
  sourceText: string;
}

/** Structured extraction from OCR text — mirrors inspection FormState fields. */
export interface ParsedInspection {
  queenSeen?: ParsedField<boolean>;
  eggsSeen?: ParsedField<boolean>;
  larvaeSeen?: ParsedField<boolean>;
  cappedBrood?: ParsedField<boolean>;
  populationEstimate?: ParsedField<string>;
  honeyStores?: ParsedField<string>;
  temperament?: ParsedField<string>;
  pollenStores?: ParsedField<string>;
  broodPatternScore?: ParsedField<number>;
  framesOfBees?: ParsedField<number>;
  framesOfBrood?: ParsedField<number>;
  pestSigns?: ParsedField<string[]>;
  diseaseSigns?: ParsedField<string[]>;
  varroaCount?: ParsedField<number>;
  numSupers?: ParsedField<number>;
  impression?: ParsedField<number>;
  attention?: ParsedField<boolean>;
  durationMinutes?: ParsedField<number>;
  tempC?: ParsedField<number>;
  humidityPercent?: ParsedField<number>;
  conditions?: ParsedField<string>;
  inspectedAt?: ParsedField<string>;
  /** Unparsed leftover text — no information is lost. */
  notes?: string;
}

/** Raw OCR output wrapper. */
export interface ScanResult {
  imageUri: string;
  rawLines: string[];
  recognizedText: string;
  scannedAt: Date;
}
