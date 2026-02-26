import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DatePickerField } from "../../../../components/DatePickerField";
import { SegmentedControl } from "../../../../components/SegmentedControl";
import { useApiary } from "../../../../hooks/useApiaries";
import { useHive } from "../../../../hooks/useHives";
import { useCreateInspection } from "../../../../hooks/useInspections";
import { useUpdateTask } from "../../../../hooks/useTasks";
import { useUnits } from "../../../../hooks/useUnits";
import { useCurrentWeather } from "../../../../hooks/useWeather";
import type { CreateInspectionInput } from "../../../../services/api";
import { mapWeatherCode } from "../../../../services/weather";
import { useStyles, typography, type ThemeColors } from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

import {
  type FormState,
  type FormSetter,
  type TemplateLevel,
  TEMPLATE_OPTIONS,
  ObservationFields,
  GeneralFields,
  ReminderFields,
  WeatherFields,
  buildObservations,
  buildWeather,
  inspectionFormStyles as createStyles,
} from "./_fields";

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
    reminder: "",
    reminderDate: null,
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

const createAutoFillStyles = (c: ThemeColors) => ({
  weatherHeader: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    gap: 6,
  },
  autoFillHint: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.honey,
  },
});

function FormContent({
  s,
  set,
  isPending,
  onSubmit,
  tempLabel,
  system,
  weatherAutoFilled,
}: {
  s: FormState;
  set: FormSetter;
  isPending: boolean;
  onSubmit: () => void;
  tempLabel: string;
  system: string;
  weatherAutoFilled: boolean;
}) {
  const styles = useStyles(createStyles);
  const autoFillStyles = useStyles(createAutoFillStyles);
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
      <View style={autoFillStyles.weatherHeader}>
        <Text style={styles.sectionLabel}>Weather</Text>
        {weatherAutoFilled && (
          <Text style={autoFillStyles.autoFillHint}>(auto-filled)</Text>
        )}
      </View>
      <WeatherFields s={s} set={set} tempLabel={tempLabel} system={system} />
      <Text style={styles.sectionLabel}>Reminder</Text>
      <ReminderFields s={s} set={set} />
      <SubmitButton isPending={isPending} onPress={onSubmit} />
    </ScrollView>
  );
}

export default function CreateInspectionScreen() {
  const { hive_id, task_id } = useLocalSearchParams<{
    hive_id: string;
    task_id?: string;
  }>();
  const router = useRouter();
  const createInspection = useCreateInspection();
  const updateTask = useUpdateTask();
  const { s, set } = useFormState();
  const units = useUnits();
  const styles = useStyles(createStyles);

  // Resolve hive → apiary → location for weather auto-fill
  const { data: hive } = useHive(hive_id!);
  const { data: apiary } = useApiary(hive?.apiary_id ?? "");
  const { data: weather } = useCurrentWeather(
    apiary?.latitude,
    apiary?.longitude,
  );

  const weatherFilled = useRef(false);
  const [weatherAutoFilled, setWeatherAutoFilled] = useState(false);

  useEffect(() => {
    if (!weather || weatherFilled.current) return;
    // Only prefill if user hasn't already entered values
    if (s.tempC === "" && s.humidityPercent === "" && s.conditions === null) {
      const displayTemp = units.toDisplayTemp(weather.temp_c);
      set("tempC", String(Math.round(displayTemp)));
      set("humidityPercent", String(weather.humidity_percent));
      set("conditions", weather.conditions);
      weatherFilled.current = true;
      setWeatherAutoFilled(true);
    }
  }, [weather, s.tempC, s.humidityPercent, s.conditions, units, set]);

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
        reminder: s.reminder.trim() || undefined,
        reminder_date: s.reminderDate
          ? s.reminderDate.toISOString().split("T")[0]
          : undefined,
      };
      const result = await createInspection.mutateAsync(input);
      if (task_id) {
        updateTask.mutate({
          id: task_id,
          data: { completed_at: new Date().toISOString() },
        });
      }
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
        weatherAutoFilled={weatherAutoFilled}
      />
    </KeyboardAvoidingView>
  );
}
