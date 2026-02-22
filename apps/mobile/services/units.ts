export type UnitSystem = "metric" | "imperial";

// Storage (metric) → Display

export function toDisplayTemp(c: number, system: UnitSystem): number {
  if (system === "imperial") return round1(c * 9 / 5 + 32);
  return round1(c);
}

export function toDisplayWeight(kg: number, system: UnitSystem): number {
  if (system === "imperial") return round1(kg * 2.20462);
  return round1(kg);
}

export function toDisplayWindSpeed(kmh: number, system: UnitSystem): number {
  if (system === "imperial") return round1(kmh * 0.621371);
  return round1(kmh);
}

// Display → Storage (metric)

export function toStorageTemp(val: number, system: UnitSystem): number {
  if (system === "imperial") return round1((val - 32) * 5 / 9);
  return round1(val);
}

export function toStorageWeight(val: number, system: UnitSystem): number {
  if (system === "imperial") return round1(val / 2.20462);
  return round1(val);
}

// Labels

export function tempLabel(system: UnitSystem): "\u00b0C" | "\u00b0F" {
  return system === "imperial" ? "\u00b0F" : "\u00b0C";
}

export function weightLabel(system: UnitSystem): "kg" | "lb" {
  return system === "imperial" ? "lb" : "kg";
}

export function windSpeedLabel(system: UnitSystem): "km/h" | "mph" {
  return system === "imperial" ? "mph" : "km/h";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
