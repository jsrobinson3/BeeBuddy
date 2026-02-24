import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { FormInput } from "../../../../components/FormInput";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { NumberInput } from "../../../../components/NumberInput";
import { PickerField } from "../../../../components/PickerField";
import { useHarvest, useUpdateHarvest, useDeleteHarvest } from "../../../../hooks/useHarvests";
import { useUnits } from "../../../../hooks/useUnits";
import type { UpdateHarvestInput } from "../../../../services/api";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  formDeleteStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

const HONEY_TYPES: { label: string; value: string }[] = [
  { label: "Wildflower", value: "wildflower" },
  { label: "Clover", value: "clover" },
  { label: "Manuka", value: "manuka" },
  { label: "Acacia", value: "acacia" },
  { label: "Buckwheat", value: "buckwheat" },
  { label: "Other", value: "other" },
];

const HONEY_COLORS: { label: string; value: string }[] = [
  { label: "Water White", value: "water_white" },
  { label: "Extra White", value: "extra_white" },
  { label: "White", value: "white" },
  { label: "Extra Light Amber", value: "extra_light_amber" },
  { label: "Light Amber", value: "light_amber" },
  { label: "Amber", value: "amber" },
  { label: "Dark Amber", value: "dark_amber" },
];

const notesInputStyle = { textAlignVertical: "top" as const, minHeight: 100 };

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  ...formDeleteStyles(c),
});

interface FormState {
  weightDisplay: number | null;
  moisturePercent: number | null;
  honeyType: string | null;
  framesHarvested: number | null;
  color: string | null;
  flavorNotes: string;
  notes: string;
}

interface FieldsProps {
  s: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

function WeightFields({ s, set, weightLabel, step }: FieldsProps & { weightLabel: string; step: number }) {
  return (
    <>
      <NumberInput
        label={`Weight (${weightLabel})`}
        value={s.weightDisplay}
        onChange={(v) => set("weightDisplay", v)}
        step={step}
        min={0}
      />
      <NumberInput
        label="Moisture (%)"
        value={s.moisturePercent}
        onChange={(v) => set("moisturePercent", v)}
        step={0.5}
        min={0}
        max={100}
      />
      <NumberInput
        label="Frames Harvested"
        value={s.framesHarvested}
        onChange={(v) => set("framesHarvested", v)}
        min={0}
      />
    </>
  );
}

function TypeFields({ s, set }: FieldsProps) {
  return (
    <>
      <PickerField
        label="Honey Type"
        options={HONEY_TYPES}
        selected={s.honeyType}
        onSelect={(v) => set("honeyType", v)}
      />
      <PickerField
        label="Color (Pfund Scale)"
        options={HONEY_COLORS}
        selected={s.color}
        onSelect={(v) => set("color", v)}
      />
    </>
  );
}

function NoteFields({ s, set }: FieldsProps) {
  return (
    <>
      <FormInput
        label="Flavor Notes"
        value={s.flavorNotes}
        onChangeText={(v) => set("flavorNotes", v)}
        placeholder="e.g. floral, mild, robust"
      />
      <FormInput
        label="Notes"
        value={s.notes}
        onChangeText={(v) => set("notes", v)}
        placeholder="Optional notes..."
        multiline
        numberOfLines={4}
        style={notesInputStyle}
      />
    </>
  );
}

function SubmitButton({ isPending, onPress }: { isPending: boolean; onPress: () => void }) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.submitButton, isPending && styles.submitDisabled]}
      onPress={onPress}
      disabled={isPending}
    >
      <Text style={styles.submitText}>{isPending ? "Saving..." : "Save Changes"}</Text>
    </Pressable>
  );
}

function FormContent(
  props: FieldsProps & {
    weightLabel: string;
    step: number;
    isPending: boolean;
    onSubmit: () => void;
    onDelete: () => void;
  },
) {
  const styles = useStyles(createStyles);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <WeightFields s={props.s} set={props.set} weightLabel={props.weightLabel} step={props.step} />
      <TypeFields s={props.s} set={props.set} />
      <NoteFields s={props.s} set={props.set} />
      <SubmitButton isPending={props.isPending} onPress={props.onSubmit} />
      <Pressable style={styles.deleteButton} onPress={props.onDelete}>
        <Text style={styles.deleteText}>Delete Harvest</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function EditHarvestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: harvest, isLoading } = useHarvest(id!);
  const updateHarvest = useUpdateHarvest();
  const deleteHarvest = useDeleteHarvest();
  const { system, toStorageWeight, toDisplayWeight, weightLabel } = useUnits();
  const styles = useStyles(createStyles);

  const [weightDisplay, setWeightDisplay] = useState<number | null>(null);
  const [moisturePercent, setMoisturePercent] = useState<number | null>(null);
  const [honeyType, setHoneyType] = useState<string | null>(null);
  const [framesHarvested, setFramesHarvested] = useState<number | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [flavorNotes, setFlavorNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (harvest && !initialized) {
      setWeightDisplay(harvest.weight_kg != null ? toDisplayWeight(harvest.weight_kg) : null);
      setMoisturePercent(harvest.moisture_percent ?? null);
      setHoneyType(harvest.honey_type ?? null);
      setFramesHarvested(harvest.frames_harvested ?? null);
      setColor(harvest.color ?? null);
      setFlavorNotes(harvest.flavor_notes ?? "");
      setNotes(harvest.notes ?? "");
      setInitialized(true);
    }
  }, [harvest, initialized, toDisplayWeight]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  function handleDelete() {
    Alert.alert("Delete Harvest?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHarvest.mutateAsync(id!);
          router.back();
        },
      },
    ]);
  }

  async function handleSubmit() {
    try {
      const data: UpdateHarvestInput = {
        weight_kg: weightDisplay != null ? toStorageWeight(weightDisplay) : undefined,
        moisture_percent: moisturePercent ?? undefined,
        honey_type: honeyType ?? undefined,
        frames_harvested: framesHarvested ?? undefined,
        color: color ?? undefined,
        flavor_notes: flavorNotes.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await updateHarvest.mutateAsync({ id: id!, data });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  const setters: Record<string, (v: any) => void> = {
    weightDisplay: setWeightDisplay,
    moisturePercent: setMoisturePercent,
    honeyType: setHoneyType,
    framesHarvested: setFramesHarvested,
    color: setColor,
    flavorNotes: setFlavorNotes,
    notes: setNotes,
  };

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setters[k](v);
  }

  const formState: FormState = {
    weightDisplay,
    moisturePercent,
    honeyType,
    framesHarvested,
    color,
    flavorNotes,
    notes,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FormContent
        s={formState}
        set={set}
        weightLabel={weightLabel}
        step={system === "imperial" ? 1 : 0.5}
        isPending={updateHarvest.isPending}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}
