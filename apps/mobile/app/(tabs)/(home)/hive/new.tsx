import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FormInput } from "../../../../components/FormInput";
import { ProgressDots } from "../../../../components/ProgressDots";
import { WizardFooter } from "../../../../components/WizardFooter";
import { useCreateHive } from "../../../../hooks/useHives";
import type { HiveType, HiveSource } from "../../../../services/api";
import { useHiveSetupStore } from "../../../../stores/hiveSetup";
import {
  useStyles,
  typography,
  spacing,
  type ThemeColors,
  pickerStyles,
} from "../../../../theme";

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

const HIVE_TYPES: { label: string; value: HiveType }[] = [
  { label: "Langstroth", value: "langstroth" },
  { label: "Top Bar", value: "top_bar" },
  { label: "Warre", value: "warre" },
  { label: "Flow", value: "flow" },
  { label: "Other", value: "other" },
];

const SOURCES: { label: string; value: HiveSource }[] = [
  { label: "Package", value: "package" },
  { label: "Nuc", value: "nuc" },
  { label: "Swarm", value: "swarm" },
  { label: "Split", value: "split" },
  { label: "Purchased", value: "purchased" },
];

// ── Styles ─────────────────────────────────────────────────────────────────────

const wizardLayoutStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 26,
    lineHeight: 33,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  notesInput: {
    textAlignVertical: "top" as const,
    minHeight: 100,
  },
});

const reviewStyles = (c: ThemeColors) => ({
  reviewCard: {
    backgroundColor: c.bgSurface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing.sm,
  },
  reviewLabel: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textMuted,
  },
  reviewValue: {
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: c.borderLight,
  },
});

const createStyles = (c: ThemeColors) => ({
  ...pickerStyles(c),
  ...wizardLayoutStyles(c),
  ...reviewStyles(c),
});

// ── Step Components ────────────────────────────────────────────────────────────

function StepName({
  styles,
}: {
  styles: ReturnType<typeof createStyles>;
}) {
  const { name, setName } = useHiveSetupStore();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Name your hive</Text>
      <Text style={styles.stepSubtitle}>
        Give your hive a unique name so you can identify it easily.
      </Text>
      <FormInput
        label="Hive Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Hive #1, Sunny Corner, Queen Bea"
        autoFocus
        returnKeyType="done"
      />
    </View>
  );
}

function Chip<T extends string>({
  label,
  value,
  isSelected,
  onPress,
  styles,
}: {
  label: string;
  value: T;
  isSelected: boolean;
  onPress: (value: T) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const chipStyle = isSelected
    ? [styles.pickerOption, styles.pickerOptionSelected]
    : styles.pickerOption;
  const textStyle = isSelected
    ? [styles.pickerOptionText, styles.pickerOptionTextSelected]
    : styles.pickerOptionText;

  return (
    <Pressable style={chipStyle} onPress={() => onPress(value)}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

function PickerChips<T extends string>({
  options,
  selected,
  onSelect,
  styles,
}: {
  options: { label: string; value: T }[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const handlePress = (value: T) => {
    onSelect(selected === value ? null : value);
  };

  const chips = options.map((opt) => (
    <Chip
      key={opt.value}
      label={opt.label}
      value={opt.value}
      isSelected={selected === opt.value}
      onPress={handlePress}
      styles={styles}
    />
  ));

  return <View style={styles.pickerRow}>{chips}</View>;
}

function StepDetails({
  styles,
}: {
  styles: ReturnType<typeof createStyles>;
}) {
  const { hiveType, source, setHiveType, setSource } = useHiveSetupStore();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Hive details</Text>
      <Text style={styles.stepSubtitle}>
        What type of hive is this and where did the bees come from? Both are
        optional.
      </Text>

      <Text style={styles.sectionLabel}>Hive Type</Text>
      <PickerChips
        options={HIVE_TYPES}
        selected={hiveType}
        onSelect={setHiveType}
        styles={styles}
      />

      <Text style={styles.sectionLabel}>Source</Text>
      <PickerChips
        options={SOURCES}
        selected={source}
        onSelect={setSource}
        styles={styles}
      />
    </View>
  );
}

function ReviewRow({
  label,
  value,
  showDivider,
  styles,
}: {
  label: string;
  value: string;
  showDivider: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue}>{value}</Text>
      </View>
      {showDivider && <View style={styles.reviewDivider} />}
    </>
  );
}

function ReviewSummary({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const { name, hiveType, source } = useHiveSetupStore();

  const typeLabelMap: Record<HiveType, string> = {
    langstroth: "Langstroth",
    top_bar: "Top Bar",
    warre: "Warre",
    flow: "Flow",
    other: "Other",
  };
  const sourceLabelMap: Record<HiveSource, string> = {
    package: "Package",
    nuc: "Nuc",
    swarm: "Swarm",
    split: "Split",
    purchased: "Purchased",
  };

  return (
    <View style={styles.reviewCard}>
      <ReviewRow
        label="Name"
        value={name || "---"}
        showDivider
        styles={styles}
      />
      <ReviewRow
        label="Type"
        value={hiveType ? typeLabelMap[hiveType] : "Not set"}
        showDivider
        styles={styles}
      />
      <ReviewRow
        label="Source"
        value={source ? sourceLabelMap[source] : "Not set"}
        showDivider={false}
        styles={styles}
      />
    </View>
  );
}

function StepReview({
  styles,
}: {
  styles: ReturnType<typeof createStyles>;
}) {
  const { notes, setNotes } = useHiveSetupStore();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Notes & review</Text>
      <Text style={styles.stepSubtitle}>
        Add any notes and review your hive details before creating.
      </Text>

      <FormInput
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional notes about this hive..."
        multiline
        numberOfLines={4}
        style={styles.notesInput}
      />

      <Text style={styles.sectionLabel}>Summary</Text>
      <ReviewSummary styles={styles} />
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function CreateHiveScreen() {
  const { apiary_id } = useLocalSearchParams<{ apiary_id: string }>();
  const router = useRouter();
  const createHive = useCreateHive();
  const styles = useStyles(createStyles);

  const { step, name, hiveType, source, notes, nextStep, prevStep, reset } =
    useHiveSetupStore();

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please go back and enter a hive name.");
      return;
    }

    try {
      await createHive.mutateAsync({
        name: name.trim(),
        apiary_id: apiary_id!,
        hive_type: hiveType ?? undefined,
        source: source ?? undefined,
        notes: notes.trim() || undefined,
      });
      reset();
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create hive");
    }
  }, [name, apiary_id, hiveType, source, notes, createHive, reset, router]);

  const handleNext = useCallback(() => {
    if (step === 0 && !name.trim()) {
      Alert.alert("Name required", "Please enter a name for your hive.");
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      nextStep();
    } else {
      handleSubmit();
    }
  }, [step, name, nextStep, handleSubmit]);

  const handleSkip = useCallback(() => {
    if (step < TOTAL_STEPS - 1) nextStep();
  }, [step, nextStep]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ProgressDots total={TOTAL_STEPS} current={step} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && <StepName styles={styles} />}
        {step === 1 && <StepDetails styles={styles} />}
        {step === 2 && <StepReview styles={styles} />}
      </ScrollView>

      <WizardFooter
        onBack={prevStep}
        onNext={handleNext}
        onSkip={step === 1 ? handleSkip : undefined}
        nextLabel={step === TOTAL_STEPS - 1 ? "Create Hive" : undefined}
        isFirst={step === 0}
        isLast={step === TOTAL_STEPS - 1}
        disabled={createHive.isPending}
      />
    </KeyboardAvoidingView>
  );
}
