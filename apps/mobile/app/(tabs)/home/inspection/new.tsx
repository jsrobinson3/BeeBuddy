import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { DropdownField } from "../../../../components/DropdownField";
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
  type RecordType,
  RECORD_TYPE_SECTIONS,
  TEMPLATE_TO_BACKEND,
  NAVIGATION_ROUTES,
  isNavigationType,
  isInspectionType,
  DEFAULT_FORM_STATE,
  ObservationFields,
  GeneralFields,
  ReminderFields,
  WeatherFields,
  buildObservations,
  buildWeather,
  inspectionFormStyles as createStyles,
} from "../../../../components/inspection/InspectionFields";

function useFormState() {
  const [s, setS] = useState<FormState>({ ...DEFAULT_FORM_STATE });

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
  label,
}: {
  isPending: boolean;
  onPress: () => void;
  label: string;
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
        {isPending ? "Creating..." : label}
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

function getObservationsLabel(template: TemplateLevel): string {
  if (template === "Mite Assessment") return "Assessment";
  if (template === "Feed Bees") return "Feeding Details";
  if (template === "Winterize") return "Preparation";
  if (template === "Journal Entry") return "";
  return "Observations";
}

function getSubmitLabel(template: TemplateLevel): string {
  if (template === "Journal Entry") return "Save Entry";
  if (template === "Feed Bees") return "Log Feeding";
  if (template === "Winterize") return "Save Winterization";
  if (template === "Mite Assessment") return "Save Assessment";
  return "Create Inspection";
}

function FormContent({
  s,
  set,
  isPending,
  onSubmit,
  onRecordTypeChange,
  tempLabel,
  system,
  weatherAutoFilled,
}: {
  s: FormState;
  set: FormSetter;
  isPending: boolean;
  onSubmit: () => void;
  onRecordTypeChange: (value: string) => void;
  tempLabel: string;
  system: string;
  weatherAutoFilled: boolean;
}) {
  const styles = useStyles(createStyles);
  const autoFillStyles = useStyles(createAutoFillStyles);
  const obsLabel = getObservationsLabel(s.template);
  const showWeather = isInspectionType(s.template);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DatePickerField
        label="Date"
        value={s.inspectedAt}
        onChange={(v) => set("inspectedAt", v)}
        placeholder="Today"
      />
      <DropdownField
        label="Record Type"
        options={RECORD_TYPE_SECTIONS}
        selected={s.template}
        onChange={onRecordTypeChange}
      />
      {obsLabel !== "" && (
        <Text style={styles.sectionLabel}>{obsLabel}</Text>
      )}
      <ObservationFields s={s} set={set} />
      <Text style={styles.sectionLabel}>General</Text>
      <GeneralFields s={s} set={set} />
      {showWeather && (
        <>
          <View style={autoFillStyles.weatherHeader}>
            <Text style={styles.sectionLabel}>Weather</Text>
            {weatherAutoFilled && (
              <Text style={autoFillStyles.autoFillHint}>(auto-filled)</Text>
            )}
          </View>
          <WeatherFields s={s} set={set} tempLabel={tempLabel} system={system} />
        </>
      )}
      <Text style={styles.sectionLabel}>Reminder</Text>
      <ReminderFields s={s} set={set} />
      <SubmitButton
        isPending={isPending}
        onPress={onSubmit}
        label={getSubmitLabel(s.template)}
      />
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
      const displayTemp = units.toDisplayTemp(weather.tempC);
      set("tempC", String(Math.round(displayTemp)));
      set("humidityPercent", String(weather.humidityPercent));
      set("conditions", weather.conditions);
      weatherFilled.current = true;
      setWeatherAutoFilled(true);
    }
  }, [weather, s.tempC, s.humidityPercent, s.conditions, units, set]);

  const handleRecordTypeChange = useCallback(
    (value: string) => {
      if (isNavigationType(value)) {
        const route = NAVIGATION_ROUTES[value];
        router.replace(`${route}?hive_id=${hive_id}` as any);
        return;
      }
      set("template", value as TemplateLevel);
    },
    [router, hive_id, set],
  );

  async function handleSubmit() {
    try {
      const weather = buildWeather(s);
      if (weather?.tempC != null) {
        weather.tempC = units.toStorageTemp(weather.tempC);
      }
      const inspectedAt = s.inspectedAt
        ? s.inspectedAt.toISOString().split("T")[0]
        : undefined;
      const input: CreateInspectionInput = {
        hiveId: hive_id!,
        inspectedAt: inspectedAt,
        experienceTemplate: TEMPLATE_TO_BACKEND[s.template],
        observations: buildObservations(s),
        weather,
        impression: s.impression ?? undefined,
        attention: s.attention,
        durationMinutes: s.durationMinutes ?? undefined,
        notes: s.notes.trim() || undefined,
        reminder: s.reminder.trim() || undefined,
        reminderDate: s.reminderDate
          ? s.reminderDate.toISOString().split("T")[0]
          : undefined,
      };
      const result = await createInspection.mutateAsync(input);
      if (task_id) {
        updateTask.mutate({
          id: task_id,
          data: { completedAt: new Date().toISOString() },
        });
      }
      router.replace(`/home/inspection/${result.id}` as any);
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
        onRecordTypeChange={handleRecordTypeChange}
        tempLabel={units.tempLabel}
        system={units.system}
        weatherAutoFilled={weatherAutoFilled}
      />
    </KeyboardAvoidingView>
  );
}
