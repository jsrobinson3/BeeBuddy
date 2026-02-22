import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { BooleanToggle } from "../../../../components/BooleanToggle";
import { FormInput } from "../../../../components/FormInput";
import { NumberInput } from "../../../../components/NumberInput";
import { useCreateQueen } from "../../../../hooks/useQueens";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  pickerStyles,
} from "../../../../theme";

type QueenOrigin = "purchased" | "raised" | "swarm";
type QueenStatus = "present" | "missing" | "superseded" | "failed";

// Queen marking colors are physical bee-marking convention colors — keep hardcoded
const MARKING_COLORS: { label: string; value: string; hex: string }[] = [
  { label: "White (2021/2026)", value: "white", hex: "#FFFFFF" },
  { label: "Yellow (2022/2027)", value: "yellow", hex: "#FFD700" },
  { label: "Red (2023/2028)", value: "red", hex: "#DC2626" },
  { label: "Green (2024/2029)", value: "green", hex: "#16A34A" },
  { label: "Blue (2025/2030)", value: "blue", hex: "#2563EB" },
];

const ORIGINS: { label: string; value: QueenOrigin }[] = [
  { label: "Purchased", value: "purchased" },
  { label: "Raised", value: "raised" },
  { label: "Swarm", value: "swarm" },
];

const STATUSES: { label: string; value: QueenStatus }[] = [
  { label: "Present", value: "present" },
  { label: "Missing", value: "missing" },
  { label: "Superseded", value: "superseded" },
  { label: "Failed", value: "failed" },
];

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...pickerStyles(c),
  ...formSubmitStyles(c),
  colorPillContent: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  colorDotBorder: { borderWidth: 1, borderColor: c.border },
});

export default function CreateQueenScreen() {
  const { hive_id } = useLocalSearchParams<{ hive_id: string }>();
  const router = useRouter();
  const createQueen = useCreateQueen();
  const styles = useStyles(createStyles);

  const [markingColor, setMarkingColor] = useState<string | null>(null);
  const [markingYear, setMarkingYear] = useState("");
  const [origin, setOrigin] = useState<QueenOrigin | null>(null);
  const [status, setStatus] = useState<QueenStatus | null>(null);
  const [race, setRace] = useState("");
  const [quality, setQuality] = useState<number | null>(null);
  const [fertilized, setFertilized] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    const yearNum = markingYear.trim() ? parseInt(markingYear.trim(), 10) : undefined;

    try {
      await createQueen.mutateAsync({
        hive_id: hive_id!,
        marking_color: markingColor ?? undefined,
        marking_year: yearNum,
        origin: origin ?? undefined,
        status: status ?? undefined,
        race: race.trim() || undefined,
        quality: quality ?? undefined,
        fertilized,
        clipped,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create queen");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pickerLabel}>Marking Color</Text>
        <View style={styles.pickerRow}>
          {MARKING_COLORS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                markingColor === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setMarkingColor(markingColor === opt.value ? null : opt.value)}
            >
              <View style={styles.colorPillContent}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: opt.hex },
                    opt.value === "white" && styles.colorDotBorder,
                  ]}
                />
                <Text
                  style={[
                    styles.pickerOptionText,
                    markingColor === opt.value && styles.pickerOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Marking Year"
          value={markingYear}
          onChangeText={setMarkingYear}
          placeholder="e.g. 2024"
          keyboardType="numeric"
        />

        <Text style={styles.pickerLabel}>Origin</Text>
        <View style={styles.pickerRow}>
          {ORIGINS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                origin === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setOrigin(origin === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  origin === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.pickerLabel}>Status</Text>
        <View style={styles.pickerRow}>
          {STATUSES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                status === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setStatus(status === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  status === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Race"
          value={race}
          onChangeText={setRace}
          placeholder="e.g. Italian, Carniolan"
        />

        <NumberInput
          label="Quality"
          value={quality}
          onChange={setQuality}
          min={1}
          max={5}
        />

        <BooleanToggle
          label="Fertilized"
          value={fertilized}
          onValueChange={setFertilized}
        />

        <BooleanToggle
          label="Clipped"
          value={clipped}
          onValueChange={setClipped}
        />

        <FormInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
          multiline
          numberOfLines={4}
          style={{ textAlignVertical: "top", minHeight: 100 }}
        />

        <Pressable
          style={[styles.submitButton, createQueen.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={createQueen.isPending}
        >
          <Text style={styles.submitText}>
            {createQueen.isPending ? "Creating..." : "Create Queen"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
