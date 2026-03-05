import { BooleanToggle } from "../BooleanToggle";
import { DatePickerField } from "../DatePickerField";
import { FormInput } from "../FormInput";
import { MultiSelect } from "../MultiSelect";
import { NumberInput } from "../NumberInput";
import { PickerField } from "../PickerField";
import { ResponsiveFormRow } from "../ResponsiveFormRow";
import type WMInspection from "../../database/models/Inspection";
import type {
  InspectionObservations,
  WeatherSnapshot,
} from "../../services/api";
import { typography, type ThemeColors } from "../../theme";

const POPULATION_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "Strong", value: "strong" },
];

const HONEY_OPTIONS = [
  { label: "Empty", value: "empty" },
  { label: "Low", value: "low" },
  { label: "Adequate", value: "adequate" },
  { label: "Full", value: "full" },
];

const TEMPERAMENT_OPTIONS = [
  { label: "Calm", value: "calm" },
  { label: "Nervous", value: "nervous" },
  { label: "Aggressive", value: "aggressive" },
];

const POLLEN_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Adequate", value: "adequate" },
  { label: "Abundant", value: "abundant" },
];

const PEST_OPTIONS = [
  "none", "varroa", "wax_moth", "hive_beetle", "ants", "other",
];
const DISEASE_OPTIONS = [
  "none", "AFB", "EFB", "nosema", "chalkbrood", "other",
];

const CONDITIONS_OPTIONS = [
  { label: "Sunny", value: "sunny" },
  { label: "Partly Cloudy", value: "partly_cloudy" },
  { label: "Cloudy", value: "cloudy" },
  { label: "Rainy", value: "rainy" },
  { label: "Windy", value: "windy" },
];

export interface FormState {
  template: "Quick Check" | "Routine Inspection" | "Detailed Inspection";
  inspectedAt: Date | null;
  queenSeen: boolean;
  eggsSeen: boolean;
  larvaeSeen: boolean;
  cappedBrood: boolean;
  populationEstimate: string | null;
  honeyStores: string | null;
  temperament: string | null;
  pollenStores: string | null;
  broodPatternScore: number | null;
  framesOfBees: number | null;
  framesOfBrood: number | null;
  pestSigns: string[];
  numSupers: number | null;
  diseaseSigns: string[];
  varroaCount: number | null;
  impression: number | null;
  attention: boolean;
  durationMinutes: number | null;
  notes: string;
  tempC: string;
  humidityPercent: string;
  conditions: string | null;
  reminder: string;
  reminderDate: Date | null;
}

export type FormSetter = <K extends keyof FormState>(
  k: K,
  v: FormState[K],
) => void;

interface SectionProps {
  s: FormState;
  set: FormSetter;
}

export function BeginnerFields({ s, set }: SectionProps) {
  return (
    <>
      <ResponsiveFormRow>
        <BooleanToggle
          label="Queen Spotted"
          value={s.queenSeen}
          onValueChange={(v) => set("queenSeen", v)}
        />
        <BooleanToggle
          label="Eggs Spotted"
          value={s.eggsSeen}
          onValueChange={(v) => set("eggsSeen", v)}
        />
      </ResponsiveFormRow>
      <ResponsiveFormRow>
        <PickerField
          label="Population"
          options={POPULATION_OPTIONS}
          selected={s.populationEstimate}
          onSelect={(v) => set("populationEstimate", v)}
        />
        <PickerField
          label="Honey Stores"
          options={HONEY_OPTIONS}
          selected={s.honeyStores}
          onSelect={(v) => set("honeyStores", v)}
        />
      </ResponsiveFormRow>
      <PickerField
        label="Temperament"
        options={TEMPERAMENT_OPTIONS}
        selected={s.temperament}
        onSelect={(v) => set("temperament", v)}
      />
    </>
  );
}

export function IntermediateFields({ s, set }: SectionProps) {
  return (
    <>
      <ResponsiveFormRow>
        <BooleanToggle
          label="Larvae Spotted"
          value={s.larvaeSeen}
          onValueChange={(v) => set("larvaeSeen", v)}
        />
        <BooleanToggle
          label="Capped Brood"
          value={s.cappedBrood}
          onValueChange={(v) => set("cappedBrood", v)}
        />
      </ResponsiveFormRow>
      <ResponsiveFormRow>
        <NumberInput
          label="Brood Pattern (1-5)"
          value={s.broodPatternScore}
          onChange={(v) => set("broodPatternScore", v)}
          min={1}
          max={5}
        />
        <NumberInput
          label="Frames of Bees"
          value={s.framesOfBees}
          onChange={(v) => set("framesOfBees", v)}
          min={0}
        />
      </ResponsiveFormRow>
      <ResponsiveFormRow>
        <NumberInput
          label="Frames of Brood"
          value={s.framesOfBrood}
          onChange={(v) => set("framesOfBrood", v)}
          min={0}
        />
        <PickerField
          label="Pollen Stores"
          options={POLLEN_OPTIONS}
          selected={s.pollenStores}
          onSelect={(v) => set("pollenStores", v)}
        />
      </ResponsiveFormRow>
      <MultiSelect
        label="Pest Signs"
        options={PEST_OPTIONS}
        selected={s.pestSigns}
        onChange={(v) => set("pestSigns", v)}
      />
    </>
  );
}

export function AdvancedFields({ s, set }: SectionProps) {
  return (
    <>
      <NumberInput
        label="Number of Supers"
        value={s.numSupers}
        onChange={(v) => set("numSupers", v)}
        min={0}
      />
      <MultiSelect
        label="Disease Signs"
        options={DISEASE_OPTIONS}
        selected={s.diseaseSigns}
        onChange={(v) => set("diseaseSigns", v)}
      />
      <NumberInput
        label="Varroa Count"
        value={s.varroaCount}
        onChange={(v) => set("varroaCount", v)}
        min={0}
      />
    </>
  );
}

const notesStyle = { textAlignVertical: "top" as const, minHeight: 100 };

export function GeneralFields({ s, set }: SectionProps) {
  return (
    <>
      <ResponsiveFormRow>
        <NumberInput
          label="Impression (1-5)"
          value={s.impression}
          onChange={(v) => set("impression", v)}
          min={1}
          max={5}
        />
        <BooleanToggle
          label="Needs Attention"
          value={s.attention}
          onValueChange={(v) => set("attention", v)}
        />
      </ResponsiveFormRow>
      <NumberInput
        label="Duration (minutes)"
        value={s.durationMinutes}
        onChange={(v) => set("durationMinutes", v)}
        min={0}
      />
      <FormInput
        label="Notes"
        value={s.notes}
        onChangeText={(v) => set("notes", v)}
        placeholder="Optional notes..."
        multiline
        numberOfLines={4}
        style={notesStyle}
      />
    </>
  );
}

export function WeatherFields({
  s,
  set,
  tempLabel,
  system,
}: SectionProps & { tempLabel: string; system: string }) {
  const tempPlaceholder = system === "imperial" ? "e.g. 72" : "e.g. 22";
  return (
    <>
      <ResponsiveFormRow>
        <FormInput
          label={`Temperature (${tempLabel})`}
          value={s.tempC}
          onChangeText={(v) => set("tempC", v)}
          keyboardType="numeric"
          placeholder={tempPlaceholder}
        />
        <FormInput
          label="Humidity (%)"
          value={s.humidityPercent}
          onChangeText={(v) => set("humidityPercent", v)}
          keyboardType="numeric"
          placeholder="e.g. 65"
        />
      </ResponsiveFormRow>
      <PickerField
        label="Conditions"
        options={CONDITIONS_OPTIONS}
        selected={s.conditions}
        onSelect={(v) => set("conditions", v)}
      />
    </>
  );
}

const reminderNotesStyle = { textAlignVertical: "top" as const, minHeight: 80 };

export function ReminderFields({ s, set }: SectionProps) {
  return (
    <>
      <DatePickerField
        label="Reminder Date"
        value={s.reminderDate}
        onChange={(v) => set("reminderDate", v)}
        placeholder="No reminder set"
      />
      <FormInput
        label="Reminder Note"
        value={s.reminder}
        onChangeText={(v) => set("reminder", v)}
        placeholder="What to check or follow up on..."
        multiline
        numberOfLines={3}
        style={reminderNotesStyle}
      />
    </>
  );
}

export function buildObservations(s: FormState): InspectionObservations {
  const isInt =
    s.template === "Routine Inspection" || s.template === "Detailed Inspection";
  const isAdv = s.template === "Detailed Inspection";

  const obs: InspectionObservations = {
    queenSeen: s.queenSeen,
    eggsSeen: s.eggsSeen,
    populationEstimate: s.populationEstimate,
    honeyStores: s.honeyStores,
    temperament: s.temperament,
  };
  if (isInt) {
    obs.larvaeSeen = s.larvaeSeen;
    obs.cappedBrood = s.cappedBrood;
    obs.broodPatternScore = s.broodPatternScore;
    obs.framesOfBees = s.framesOfBees;
    obs.framesOfBrood = s.framesOfBrood;
    obs.pollenStores = s.pollenStores;
    obs.pestSigns = s.pestSigns.filter((v) => v !== "none");
  }
  if (isAdv) {
    obs.numSupers = s.numSupers;
    obs.diseaseSigns = s.diseaseSigns.filter((v) => v !== "none");
    obs.varroaCount = s.varroaCount;
  }
  return obs;
}

export function buildWeather(s: FormState): WeatherSnapshot | undefined {
  const temp = s.tempC.trim() ? Number(s.tempC) : null;
  const hum = s.humidityPercent.trim()
    ? Number(s.humidityPercent)
    : null;
  if (temp === null && hum === null && !s.conditions) {
    return undefined;
  }
  return {
    tempC: temp,
    humidityPercent: hum,
    conditions: s.conditions,
  };
}

export type TemplateLevel = FormState["template"];

export const TEMPLATE_OPTIONS: {
  label: string;
  value: TemplateLevel;
  description: string;
}[] = [
  {
    label: "Quick Check",
    value: "Quick Check",
    description: "Basic observations — queen, eggs, stores",
  },
  {
    label: "Routine Inspection",
    value: "Routine Inspection",
    description: "Standard check with brood, pollen & pests",
  },
  {
    label: "Detailed Inspection",
    value: "Detailed Inspection",
    description: "Full assessment including disease & varroa",
  },
];

export const inspectionFormStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 8,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

export function ObservationFields({
  s,
  set,
}: {
  s: FormState;
  set: FormSetter;
}) {
  const isRoutine =
    s.template === "Routine Inspection" || s.template === "Detailed Inspection";
  const isDetailed = s.template === "Detailed Inspection";
  return (
    <>
      <BeginnerFields s={s} set={set} />
      {isRoutine && <IntermediateFields s={s} set={set} />}
      {isDetailed && <AdvancedFields s={s} set={set} />}
    </>
  );
}

const BACKEND_TO_TEMPLATE: Record<string, FormState["template"]> = {
  beginner: "Quick Check",
  intermediate: "Routine Inspection",
  advanced: "Detailed Inspection",
};

export const TEMPLATE_TO_BACKEND: Record<FormState["template"], string> = {
  "Quick Check": "beginner",
  "Routine Inspection": "intermediate",
  "Detailed Inspection": "advanced",
};

export function inspectionToFormState(inspection: WMInspection): FormState {
  const obs = inspection.observations ?? {};
  const weather = inspection.weather ?? {};

  return {
    template:
      BACKEND_TO_TEMPLATE[inspection.experienceTemplate ?? "beginner"] ??
      "Quick Check",
    inspectedAt: inspection.inspectedAt instanceof Date
      ? inspection.inspectedAt
      : null,
    queenSeen: obs.queenSeen ?? false,
    eggsSeen: obs.eggsSeen ?? false,
    larvaeSeen: obs.larvaeSeen ?? false,
    cappedBrood: obs.cappedBrood ?? false,
    populationEstimate: obs.populationEstimate ?? null,
    honeyStores: obs.honeyStores ?? null,
    temperament: obs.temperament ?? null,
    pollenStores: obs.pollenStores ?? null,
    broodPatternScore: obs.broodPatternScore ?? null,
    framesOfBees: obs.framesOfBees ?? null,
    framesOfBrood: obs.framesOfBrood ?? null,
    pestSigns: obs.pestSigns ?? [],
    numSupers: obs.numSupers ?? null,
    diseaseSigns: obs.diseaseSigns ?? [],
    varroaCount: obs.varroaCount ?? null,
    impression: inspection.impression ?? null,
    attention: inspection.attention ?? false,
    durationMinutes: inspection.durationMinutes ?? null,
    notes: inspection.notes ?? "",
    tempC: weather.tempC != null ? String(weather.tempC) : "",
    humidityPercent:
      weather.humidityPercent != null
        ? String(weather.humidityPercent)
        : "",
    conditions: weather.conditions ?? null,
    reminder: inspection.reminder ?? "",
    reminderDate: inspection.reminderDate
      ? new Date(inspection.reminderDate)
      : null,
  };
}
