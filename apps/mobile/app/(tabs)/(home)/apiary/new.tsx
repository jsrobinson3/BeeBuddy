import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { FormInput } from "../../../../components/FormInput";
import { useCreateApiary } from "../../../../hooks/useApiaries";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
} from "../../../../theme";

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
});

export default function CreateApiaryScreen() {
  const router = useRouter();
  const createApiary = useCreateApiary();
  const styles = useStyles(createStyles);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();

  async function handleSubmit() {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError(undefined);

    const lat = latitude.trim() ? parseFloat(latitude.trim()) : undefined;
    const lng = longitude.trim() ? parseFloat(longitude.trim()) : undefined;

    try {
      await createApiary.mutateAsync({
        name: name.trim(),
        city: city.trim() || undefined,
        latitude: lat !== undefined && !isNaN(lat) ? lat : undefined,
        longitude: lng !== undefined && !isNaN(lng) ? lng : undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create apiary");
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
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          placeholder="e.g. Home Apiary"
          autoFocus
        />

        <FormInput
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Portland"
        />

        <FormInput
          label="Latitude"
          value={latitude}
          onChangeText={setLatitude}
          placeholder="e.g. -33.8688 (optional)"
          keyboardType="numeric"
        />

        <FormInput
          label="Longitude"
          value={longitude}
          onChangeText={setLongitude}
          placeholder="e.g. 151.2093 (optional)"
          keyboardType="numeric"
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
          style={[styles.submitButton, createApiary.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={createApiary.isPending}
        >
          <Text style={styles.submitText}>
            {createApiary.isPending ? "Creating..." : "Create Apiary"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
