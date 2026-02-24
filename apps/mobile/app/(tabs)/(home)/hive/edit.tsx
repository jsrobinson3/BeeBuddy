import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useHive, useUpdateHive, useDeleteHive } from "../../../../hooks/useHives";
import type { HiveType, HiveSource, HiveStatus } from "../../../../services/api";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  formDeleteStyles,
  pickerStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

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

const STATUSES: { label: string; value: HiveStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Dead", value: "dead" },
  { label: "Combined", value: "combined" },
  { label: "Sold", value: "sold" },
];

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  ...formDeleteStyles(c),
  ...pickerStyles(c),
});

export default function EditHiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: hive, isLoading } = useHive(id!);
  const updateHive = useUpdateHive();
  const deleteHive = useDeleteHive();
  const styles = useStyles(createStyles);

  const [name, setName] = useState("");
  const [hiveType, setHiveType] = useState<HiveType | null>(null);
  const [source, setSource] = useState<HiveSource | null>(null);
  const [status, setStatus] = useState<HiveStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (hive && !initialized) {
      setName(hive.name ?? "");
      setHiveType(hive.hive_type ?? null);
      setSource(hive.source ?? null);
      setStatus(hive.status ?? null);
      setNotes(hive.notes ?? "");
      setInitialized(true);
    }
  }, [hive, initialized]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  function handleDelete() {
    Alert.alert("Delete Hive?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHive.mutateAsync(id!);
          router.back();
        },
      },
    ]);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    try {
      await updateHive.mutateAsync({
        id: id!,
        data: {
          name: name.trim(),
          hive_type: hiveType ?? undefined,
          source: source ?? undefined,
          status: status ?? undefined,
          notes: notes.trim() || undefined,
        },
      });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <FormInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Hive #1"
        />

        <Text style={styles.pickerLabel}>Hive Type</Text>
        <View style={styles.pickerRow}>
          {HIVE_TYPES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                hiveType === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setHiveType(hiveType === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  hiveType === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.pickerLabel}>Source</Text>
        <View style={styles.pickerRow}>
          {SOURCES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                source === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setSource(source === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  source === opt.value && styles.pickerOptionTextSelected,
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
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
          multiline
          numberOfLines={4}
          style={{ textAlignVertical: "top", minHeight: 100 }}
        />

        <Pressable
          style={[styles.submitButton, updateHive.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={updateHive.isPending}
        >
          <Text style={styles.submitText}>
            {updateHive.isPending ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Hive</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
