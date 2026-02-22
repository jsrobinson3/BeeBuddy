import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { DatePickerField } from "../../../../components/DatePickerField";
import { SegmentedControl } from "../../../../components/SegmentedControl";
import { useCreateInspection } from "../../../../hooks/useInspections";
import { useUnits } from "../../../../hooks/useUnits";
import type { CreateInspectionInput } from "../../../../services/api";
import { useStyles, typography, type ThemeColors } from "../../../../theme";

import {
  type FormState,
  type FormSetter,
  BeginnerFields,
  IntermediateFields,
  AdvancedFields,
  GeneralFields,
  WeatherFields,
  buildObservations,
  buildWeather,
} from "./fields";

type TemplateLevel = FormState["template"];

const TEMPLATE_OPTIONS: TemplateLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

const createStyles = (c: ThemeColors) => ({
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

function useFormState() {
  const [s, setS] = useState<FormState>({
    template: "Beginner",
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
    impression: null,
    attention: false,
    durationMinutes: null,
    notes: "",
    tempC: "",
    humidityPercent: "",
    conditions: null,
  });

  function set<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  return { s, set };
}

function SubmitButton({
  isPending,
  onPress,
}: {
  isPending: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[
        styles.submitButton,
        isPending && styles.submitDisabled,
      ]}
      onPress={onPress}
      disabled={isPending}
    >
      <Text style={styles.submitText}>
        {isPending ? "Creating..." : "Create Inspection"}
      </Text>
    </Pressable>
  );
}

function ObservationFields({ s, set }: { s: FormState; set: FormSetter }) {
  const isInt = s.template === "Intermediate" || s.template === "Advanced";
  const isAdv = s.template === "Advanced";
  return (
    <>
      <BeginnerFields s={s} set={set} />
      {isInt && <IntermediateFields s={s} set={set} />}
      {isAdv && <AdvancedFields s={s} set={set} />}
    </>
  );
}

function FormContent({
  s,
  set,
  isPending,
  onSubmit,
  tempLabel,
  system,
}: {
  s: FormState;
  set: FormSetter;
  isPending: boolean;
  onSubmit: () => void;
  tempLabel: string;
  system: string;
}) {
  const styles = useStyles(createStyles);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DatePickerField
        label="Inspection Date"
        value={s.inspectedAt}
        onChange={(v) => set("inspectedAt", v)}
        placeholder="Today"
      />
      <SegmentedControl
        options={TEMPLATE_OPTIONS}
        selected={s.template}
        onChange={(v) => set("template", v as TemplateLevel)}
      />
      <Text style={styles.sectionLabel}>Observations</Text>
      <ObservationFields s={s} set={set} />
      <Text style={styles.sectionLabel}>General</Text>
      <GeneralFields s={s} set={set} />
      <Text style={styles.sectionLabel}>Weather</Text>
      <WeatherFields s={s} set={set} tempLabel={tempLabel} system={system} />
      <SubmitButton isPending={isPending} onPress={onSubmit} />
    </ScrollView>
  );
}

export default function CreateInspectionScreen() {
  const { hive_id } = useLocalSearchParams<{ hive_id: string }>();
  const router = useRouter();
  const createInspection = useCreateInspection();
  const { s, set } = useFormState();
  const units = useUnits();
  const styles = useStyles(createStyles);

  async function handleSubmit() {
    try {
      const weather = buildWeather(s);
      if (weather?.temp_c != null) {
        weather.temp_c = units.toStorageTemp(weather.temp_c);
      }
      const inspectedAt = s.inspectedAt
        ? s.inspectedAt.toISOString().split("T")[0]
        : undefined;
      const input: CreateInspectionInput = {
        hive_id: hive_id!,
        inspected_at: inspectedAt,
        experience_template: s.template.toLowerCase(),
        observations: buildObservations(s),
        weather,
        impression: s.impression ?? undefined,
        attention: s.attention,
        duration_minutes: s.durationMinutes ?? undefined,
        notes: s.notes.trim() || undefined,
      };
      const result = await createInspection.mutateAsync(input);
      router.replace(`/inspection/${result.id}` as any);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message ?? "Failed to create inspection",
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FormContent
        s={s}
        set={set}
        isPending={createInspection.isPending}
        onSubmit={handleSubmit}
        tempLabel={units.tempLabel}
        system={units.system}
      />
    </KeyboardAvoidingView>
  );
}
