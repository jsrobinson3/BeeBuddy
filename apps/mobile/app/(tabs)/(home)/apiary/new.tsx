import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FormInput } from "../../../../components/FormInput";
import { PickerField } from "../../../../components/PickerField";
import { useCreateApiary } from "../../../../hooks/useApiaries";
import {
  useLocation,
  roundToPrecision,
  type LocationPrecision,
} from "../../../../hooks/useLocation";
import {
  useStyles,
  useTheme,
  type ThemeColors,
  typography,
  formContainerStyles,
  formSubmitStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

const PRECISION_OPTIONS = [
  { label: "Exact (~11 m)", value: "exact" },
  { label: "Approximate (~1 km)", value: "approximate" },
  { label: "General area (~11 km)", value: "general" },
];

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  locationRow: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 16,
  },
  locationField: {
    flex: 1,
  },
  locationButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.honey,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  locationButtonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
  locationButtons: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: "row" as const,
    gap: 8,
    alignItems: "flex-end" as const,
    marginBottom: 16,
  },
  addressInput: {
    flex: 1,
  },
  lookupButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
  },
  lookupButtonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  precisionHint: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginTop: -8,
    marginBottom: 16,
  },
});

export default function CreateApiaryScreen() {
  const router = useRouter();
  const createApiary = useCreateApiary();
  const { getLocation, geocodeAddress, loading: locating, geocoding } = useLocation();
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [precision, setPrecision] = useState<LocationPrecision>("approximate");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();

  async function handleUseMyLocation() {
    const coords = await getLocation();
    if (coords) {
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
    }
  }

  async function handleLookupAddress() {
    const coords = await geocodeAddress(address);
    if (coords) {
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError(undefined);

    const rawLat = latitude.trim() ? parseFloat(latitude.trim()) : undefined;
    const rawLng = longitude.trim() ? parseFloat(longitude.trim()) : undefined;

    // Apply the user's chosen precision before sending to the API
    const lat =
      rawLat !== undefined && !isNaN(rawLat)
        ? roundToPrecision(rawLat, precision)
        : undefined;
    const lng =
      rawLng !== undefined && !isNaN(rawLng)
        ? roundToPrecision(rawLng, precision)
        : undefined;

    try {
      await createApiary.mutateAsync({
        name: name.trim(),
        city: city.trim() || undefined,
        latitude: lat,
        longitude: lng,
        notes: notes.trim() || undefined,
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

        <View style={styles.addressRow}>
          <View style={styles.addressInput}>
            <FormInput
              label="Address or Place"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. 123 Main St, Portland OR"
            />
          </View>
          <Pressable
            style={styles.lookupButton}
            onPress={handleLookupAddress}
            disabled={geocoding || !address.trim()}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={styles.lookupButtonText}>Look Up</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.locationButtons}>
          <Pressable
            style={[styles.locationButton, { flex: 1 }]}
            onPress={handleUseMyLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.honey} />
            ) : (
              <Text style={styles.locationButtonText}>Use My Location</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.locationRow}>
          <View style={styles.locationField}>
            <FormInput
              label="Latitude"
              value={latitude}
              onChangeText={setLatitude}
              placeholder="e.g. -33.8688"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.locationField}>
            <FormInput
              label="Longitude"
              value={longitude}
              onChangeText={setLongitude}
              placeholder="e.g. 151.2093"
              keyboardType="numeric"
            />
          </View>
        </View>

        <PickerField
          label="Location Precision"
          options={PRECISION_OPTIONS}
          selected={precision}
          onSelect={(val) => {
            if (val) setPrecision(val as LocationPrecision);
          }}
        />
        <Text style={styles.precisionHint}>
          {precision === "exact"
            ? "Full precision stored. Best for your own records."
            : precision === "approximate"
              ? "Rounded to ~1 km. Hides your exact address from shared data."
              : "Rounded to ~11 km. Only the general region is stored."}
        </Text>

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
