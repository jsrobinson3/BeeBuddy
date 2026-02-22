import { useCurrentUser } from "./useUser";
import {
  toDisplayTemp,
  toStorageTemp,
  toDisplayWeight,
  toStorageWeight,
  toDisplayWindSpeed,
  tempLabel,
  weightLabel,
  windSpeedLabel,
} from "../services/units";
import type { UnitSystem } from "../services/units";

export function useUnits() {
  const { data: user } = useCurrentUser();
  const system: UnitSystem =
    user?.preferences?.units === "imperial" ? "imperial" : "metric";

  return {
    system,
    toDisplayTemp: (c: number) => toDisplayTemp(c, system),
    toStorageTemp: (v: number) => toStorageTemp(v, system),
    toDisplayWeight: (kg: number) => toDisplayWeight(kg, system),
    toStorageWeight: (v: number) => toStorageWeight(v, system),
    toDisplayWindSpeed: (kmh: number) => toDisplayWindSpeed(kmh, system),
    tempLabel: tempLabel(system),
    weightLabel: weightLabel(system),
    windSpeedLabel: windSpeedLabel(system),
  };
}
