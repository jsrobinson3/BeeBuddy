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
import { useStyles } from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

import {
  type FormState,
  type FormSetter,
  type TemplateLevel,
  TEMPLATE_OPTIONS,
  ObservationFields,
  GeneralFields,
  WeatherFields,
  buildObservations,
  buildWeather,
  inspectionFormStyles as createStyles,
} from "./fields";

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
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
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
