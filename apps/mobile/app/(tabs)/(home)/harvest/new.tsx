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

import { FormInput } from "../../../../components/FormInput";
import { NumberInput } from "../../../../components/NumberInput";
import { useCreateHarvest } from "../../../../hooks/useHarvests";
import { useUnits } from "../../../../hooks/useUnits";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  pickerStyles,
} from "../../../../theme";

const HONEY_TYPES: { label: string; value: string }[] = [
  { label: "Wildflower", value: "wildflower" },
  { label: "Clover", value: "clover" },
  { label: "Manuka", value: "manuka" },
  { label: "Acacia", value: "acacia" },
  { label: "Buckwheat", value: "buckwheat" },
  { label: "Other", value: "other" },
];

// Honey color scale (Pfund) represents physical honey colors — keep hardcoded
const HONEY_COLORS: { label: string; value: string }[] = [
  { label: "Water White", value: "water_white" },
  { label: "Extra White", value: "extra_white" },
  { label: "White", value: "white" },
  { label: "Extra Light Amber", value: "extra_light_amber" },
  { label: "Light Amber", value: "light_amber" },
  { label: "Amber", value: "amber" },
  { label: "Dark Amber", value: "dark_amber" },
];

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...pickerStyles(c),
  ...formSubmitStyles(c),
});

export default function CreateHarvestScreen() {
  const { hive_id } = useLocalSearchParams<{ hive_id: string }>();
  const router = useRouter();
  const createHarvest = useCreateHarvest();
  const { system, toStorageWeight, weightLabel } = useUnits();
  const styles = useStyles(createStyles);

  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [moisturePercent, setMoisturePercent] = useState<number | null>(null);
  const [honeyType, setHoneyType] = useState<string | null>(null);
  const [framesHarvested, setFramesHarvested] = useState<number | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [flavorNotes, setFlavorNotes] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    try {
      await createHarvest.mutateAsync({
        hive_id: hive_id!,
        weight_kg: weightKg != null ? toStorageWeight(weightKg) : undefined,
        moisture_percent: moisturePercent ?? undefined,
        honey_type: honeyType ?? undefined,
        frames_harvested: framesHarvested ?? undefined,
        color: color ?? undefined,
        flavor_notes: flavorNotes.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create harvest");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <NumberInput
          label={`Weight (${weightLabel})`}
          value={weightKg}
          onChange={setWeightKg}
          step={system === "imperial" ? 1 : 0.5}
          min={0}
        />

        <NumberInput
          label="Moisture (%)"
          value={moisturePercent}
          onChange={setMoisturePercent}
          step={0.5}
          min={0}
          max={100}
        />

        <Text style={styles.pickerLabel}>Honey Type</Text>
        <View style={styles.pickerRow}>
          {HONEY_TYPES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                honeyType === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setHoneyType(honeyType === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  honeyType === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <NumberInput
          label="Frames Harvested"
          value={framesHarvested}
          onChange={setFramesHarvested}
          min={0}
        />

        <Text style={styles.pickerLabel}>Color (Pfund Scale)</Text>
        <View style={styles.pickerRow}>
          {HONEY_COLORS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                color === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setColor(color === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  color === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Flavor Notes"
          value={flavorNotes}
          onChangeText={setFlavorNotes}
          placeholder="e.g. floral, mild, robust"
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
          style={[styles.submitButton, createHarvest.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={createHarvest.isPending}
        >
          <Text style={styles.submitText}>
            {createHarvest.isPending ? "Creating..." : "Create Harvest"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
