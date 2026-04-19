import { BooleanToggle } from "../BooleanToggle";
import { DatePickerField } from "../DatePickerField";
import type { DropdownSection } from "../DropdownField";
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

export const BROOD_PATTERN_OPTIONS = [
  { label: "Excellent", value: "excellent" },
  { label: "Good", value: "good" },
  { label: "Spotty", value: "spotty" },
  { label: "Poor", value: "poor" },
  { label: "Failing", value: "failing" },
];

const NUMERIC_TO_BROOD_PATTERN: Record<number, string> = {
  5: "excellent",
  4: "good",
  3: "spotty",
  2: "poor",
  1: "failing",
};

export function broodPatternLabel(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const stringValue =
    typeof value === "number" ? NUMERIC_TO_BROOD_PATTERN[value] ?? String(value) : value;
  const match = BROOD_PATTERN_OPTIONS.find((o) => o.value === stringValue);
  return match ? match.label : stringValue;
}

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

export type InlineFormType =
  | "Quick Check"
  | "Routine Inspection"
  | "Detailed Inspection"
  | "Mite Assessment"
  | "Feed Bees"
  | "Winterize"
  | "Journal Entry";

export type NavigationFormType = "Treatment" | "Harvest" | "Requeen";

export type RecordType = InlineFormType | NavigationFormType;

export const NAVIGATION_ROUTES: Record<NavigationFormType, string> = {
  Treatment: "/home/treatment/new",
  Harvest: "/home/harvest/new",
  Requeen: "/home/queen/new",
};

export function isNavigationType(type: string): type is NavigationFormType {
  return type in NAVIGATION_ROUTES;
}

export interface FormState {
  template: InlineFormType;
  inspectedAt: Date | null;
  // Inspection observation fields
  queenSeen: boolean;
  eggsSeen: boolean;
  larvaeSeen: boolean;
  cappedBrood: boolean;
  populationEstimate: string | null;
  honeyStores: string | null;
  temperament: string | null;
  pollenStores: string | null;
  broodPatternScore: string | null;
  framesOfBees: number | null;
  framesOfBrood: number | null;
  pestSigns: string[];
  numSupers: number | null;
  diseaseSigns: string[];
  varroaCount: number | null;
  // Mite assessment fields
  miteMethod: string | null;
  miteSampleSize: number | null;
  // Feed bees fields
  feedType: string | null;
  feedAmount: string;
  feedUnit: string | null;
  // Winterize fields
  winterizeChecklist: string[];
  // General fields
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
      <PickerField
        label="Brood Pattern"
        options={BROOD_PATTERN_OPTIONS}
        selected={s.broodPatternScore}
        onSelect={(v) => set("broodPatternScore", v)}
      />
      <ResponsiveFormRow>
        <NumberInput
          label="Frames of Bees"
          value={s.framesOfBees}
          onChange={(v) => set("framesOfBees", v)}
          min={0}
          step={0.5}
        />
        <NumberInput
          label="Frames of Brood"
          value={s.framesOfBrood}
          onChange={(v) => set("framesOfBrood", v)}
          min={0}
          step={0.5}
        />
      </ResponsiveFormRow>
      <PickerField
        label="Pollen Stores"
        options={POLLEN_OPTIONS}
        selected={s.pollenStores}
        onSelect={(v) => set("pollenStores", v)}
      />
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

const MITE_METHOD_OPTIONS = [
  { label: "Sugar Roll", value: "sugar_roll" },
  { label: "Alcohol Wash", value: "alcohol_wash" },
  { label: "Sticky Board", value: "sticky_board" },
  { label: "Visual", value: "visual" },
];

const FEED_TYPE_OPTIONS = [
  { label: "Sugar Syrup 1:1", value: "syrup_1_1" },
  { label: "Sugar Syrup 2:1", value: "syrup_2_1" },
  { label: "Pollen Patty", value: "pollen_patty" },
  { label: "Fondant", value: "fondant" },
  { label: "Other", value: "other" },
];

const FEED_UNIT_OPTIONS = [
  { label: "Liters", value: "liters" },
  { label: "Kg", value: "kg" },
  { label: "Lbs", value: "lbs" },
  { label: "Frames", value: "frames" },
];

const WINTERIZE_OPTIONS = [
  "mouse_guard",
  "entrance_reducer",
  "insulation",
  "ventilation",
  "moisture_board",
  "candy_board",
  "windbreak",
];

export function MiteAssessmentFields({ s, set }: SectionProps) {
  return (
    <>
      <PickerField
        label="Method"
        options={MITE_METHOD_OPTIONS}
        selected={s.miteMethod}
        onSelect={(v) => set("miteMethod", v)}
      />
      <ResponsiveFormRow>
        <NumberInput
          label="Varroa Count"
          value={s.varroaCount}
          onChange={(v) => set("varroaCount", v)}
          min={0}
        />
        <NumberInput
          label="Sample Size (bees)"
          value={s.miteSampleSize}
          onChange={(v) => set("miteSampleSize", v)}
          min={0}
        />
      </ResponsiveFormRow>
    </>
  );
}

export function FeedBeesFields({ s, set }: SectionProps) {
  return (
    <>
      <PickerField
        label="Feed Type"
        options={FEED_TYPE_OPTIONS}
        selected={s.feedType}
        onSelect={(v) => set("feedType", v)}
      />
      <ResponsiveFormRow>
        <FormInput
          label="Amount"
          value={s.feedAmount}
          onChangeText={(v) => set("feedAmount", v)}
          keyboardType="numeric"
          placeholder="e.g. 2"
        />
        <PickerField
          label="Unit"
          options={FEED_UNIT_OPTIONS}
          selected={s.feedUnit}
          onSelect={(v) => set("feedUnit", v)}
        />
      </ResponsiveFormRow>
    </>
  );
}

export function WinterizeFields({ s, set }: SectionProps) {
  return (
    <MultiSelect
      label="Winterization Checklist"
      options={WINTERIZE_OPTIONS}
      selected={s.winterizeChecklist}
      onChange={(v) => set("winterizeChecklist", v)}
    />
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

export function getObservationsLabel(template: TemplateLevel): string {
  if (template === "Mite Assessment") return "Assessment";
  if (template === "Feed Bees") return "Feeding Details";
  if (template === "Winterize") return "Preparation";
  if (template === "Journal Entry") return "";
  return "Observations";
}

export function getSubmitLabel(template: TemplateLevel): string {
  if (template === "Journal Entry") return "Save Entry";
  if (template === "Feed Bees") return "Log Feeding";
  if (template === "Winterize") return "Save Winterization";
  if (template === "Mite Assessment") return "Save Assessment";
  return "Save Inspection";
}

export function isInspectionType(t: InlineFormType): boolean {
  return t === "Quick Check" || t === "Routine Inspection" || t === "Detailed Inspection";
}

export function buildObservations(s: FormState): InspectionObservations {
  const t = s.template;

  if (t === "Mite Assessment") {
    return {
      varroaCount: s.varroaCount,
      miteMethod: s.miteMethod,
      miteSampleSize: s.miteSampleSize,
    };
  }
  if (t === "Feed Bees") {
    return {
      feedType: s.feedType,
      feedAmount: s.feedAmount.trim() ? Number(s.feedAmount) : null,
      feedUnit: s.feedUnit,
    };
  }
  if (t === "Winterize") {
    return {
      winterizeChecklist: s.winterizeChecklist,
    };
  }
  if (t === "Journal Entry") {
    return {};
  }

  // Inspection types (Quick Check / Routine / Detailed)
  const isRoutine = t === "Routine Inspection" || t === "Detailed Inspection";
  const isDetailed = t === "Detailed Inspection";

  const obs: InspectionObservations = {
    queenSeen: s.queenSeen,
    eggsSeen: s.eggsSeen,
    populationEstimate: s.populationEstimate,
    honeyStores: s.honeyStores,
    temperament: s.temperament,
  };
  if (isRoutine) {
    obs.larvaeSeen = s.larvaeSeen;
    obs.cappedBrood = s.cappedBrood;
    obs.broodPatternScore = s.broodPatternScore;
    obs.framesOfBees = s.framesOfBees;
    obs.framesOfBrood = s.framesOfBrood;
    obs.pollenStores = s.pollenStores;
    obs.pestSigns = s.pestSigns.filter((v) => v !== "none");
  }
  if (isDetailed) {
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

export const RECORD_TYPE_SECTIONS: DropdownSection[] = [
  {
    title: "Inspections",
    options: [
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
    ],
  },
  {
    title: "Management",
    options: [
      {
        label: "Feed Bees",
        value: "Feed Bees",
        description: "Record a feeding with type and amount",
      },
      {
        label: "Mite Assessment",
        value: "Mite Assessment",
        description: "Varroa mite count and monitoring",
      },
      {
        label: "Winterize",
        value: "Winterize",
        description: "Winterization prep checklist",
      },
    ],
  },
  {
    title: "Records",
    options: [
      {
        label: "Treatment",
        value: "Treatment",
        description: "Log a treatment application",
      },
      {
        label: "Harvest",
        value: "Harvest",
        description: "Record a honey harvest",
      },
      {
        label: "Requeen",
        value: "Requeen",
        description: "Record a queen change",
      },
      {
        label: "Journal Entry",
        value: "Journal Entry",
        description: "Quick note about the hive",
      },
    ],
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
  const t = s.template;

  if (t === "Mite Assessment") return <MiteAssessmentFields s={s} set={set} />;
  if (t === "Feed Bees") return <FeedBeesFields s={s} set={set} />;
  if (t === "Winterize") return <WinterizeFields s={s} set={set} />;
  if (t === "Journal Entry") return null;

  // Inspection types
  const isRoutine = t === "Routine Inspection" || t === "Detailed Inspection";
  const isDetailed = t === "Detailed Inspection";
  return (
    <>
      <BeginnerFields s={s} set={set} />
      {isRoutine && <IntermediateFields s={s} set={set} />}
      {isDetailed && <AdvancedFields s={s} set={set} />}
    </>
  );
}

export const BACKEND_TO_TEMPLATE: Record<string, FormState["template"]> = {
  beginner: "Quick Check",
  intermediate: "Routine Inspection",
  advanced: "Detailed Inspection",
  mite_assessment: "Mite Assessment",
  feed_bees: "Feed Bees",
  winterize: "Winterize",
  journal_entry: "Journal Entry",
};

export const TEMPLATE_TO_BACKEND: Record<FormState["template"], string> = {
  "Quick Check": "beginner",
  "Routine Inspection": "intermediate",
  "Detailed Inspection": "advanced",
  "Mite Assessment": "mite_assessment",
  "Feed Bees": "feed_bees",
  "Winterize": "winterize",
  "Journal Entry": "journal_entry",
};

export const DEFAULT_FORM_STATE: FormState = {
  template: "Quick Check",
  inspectedAt: null,
  queenSeen: false,
  eggsSeen: false,
  larvaeSeen: false,
  cappedBrood: false,
  populationEstimate: null,
  honeyStores: null,
  temperament: null,
  pollenStores: null,
  broodPatternScore: null,
  framesOfBees: null,
  framesOfBrood: null,
  pestSigns: [],
  numSupers: null,
  diseaseSigns: [],
  varroaCount: null,
  miteMethod: null,
  miteSampleSize: null,
  feedType: null,
  feedAmount: "",
  feedUnit: null,
  winterizeChecklist: [],
  impression: null,
  attention: false,
  durationMinutes: null,
  notes: "",
  tempC: "",
  humidityPercent: "",
  conditions: null,
  reminder: "",
  reminderDate: null,
};

export function inspectionToFormState(inspection: WMInspection): FormState {
  const obs: InspectionObservations = inspection.observations ?? {};
  const weather = inspection.weather ?? {};

  return {
    ...DEFAULT_FORM_STATE,
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
    broodPatternScore:
      typeof obs.broodPatternScore === "number"
        ? NUMERIC_TO_BROOD_PATTERN[obs.broodPatternScore] ?? null
        : obs.broodPatternScore ?? null,
    framesOfBees: obs.framesOfBees ?? null,
    framesOfBrood: obs.framesOfBrood ?? null,
    pestSigns: obs.pestSigns ?? [],
    numSupers: obs.numSupers ?? null,
    diseaseSigns: obs.diseaseSigns ?? [],
    varroaCount: obs.varroaCount ?? null,
    miteMethod: obs.miteMethod ?? null,
    miteSampleSize: obs.miteSampleSize ?? null,
    feedType: obs.feedType ?? null,
    feedAmount: obs.feedAmount != null ? String(obs.feedAmount) : "",
    feedUnit: obs.feedUnit ?? null,
    winterizeChecklist: obs.winterizeChecklist ?? [],
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
