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
import { useApiary, useUpdateApiary, useDeleteApiary } from "../../../../hooks/useApiaries";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  formDeleteStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  ...formDeleteStyles(c),
});

export default function EditApiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: apiary, isLoading } = useApiary(id!);
  const updateApiary = useUpdateApiary();
  const deleteApiary = useDeleteApiary();
  const styles = useStyles(createStyles);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (apiary && !initialized) {
      setName(apiary.name ?? "");
      setCity(apiary.city ?? "");
      setNotes(apiary.notes ?? "");
      setInitialized(true);
    }
  }, [apiary, initialized]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    try {
      await updateApiary.mutateAsync({
        id: id!,
        data: {
          name: name.trim(),
          city: city.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Apiary?",
      "This will permanently delete this apiary and all its hives.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteApiary.mutateAsync(id!);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Home Apiary" />
        <FormInput label="City" value={city} onChangeText={setCity} placeholder="e.g. Portland" />
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
          style={[styles.submitButton, updateApiary.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={updateApiary.isPending}
        >
          <Text style={styles.submitText}>
            {updateApiary.isPending ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Apiary</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
