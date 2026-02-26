import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";

import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import {
  useApiary,
  useUpdateApiary,
  useDeleteApiary,
} from "../../../../hooks/useApiaries";
import {
  useLocation,
  roundToPrecision,
  type LocationPrecision,
} from "../../../../hooks/useLocation";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";
import { EditApiaryForm } from "./_EditApiaryForm";

/* ---------- Styles ---------- */

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
});

/* ---------- Screen ---------- */

export default function EditApiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: apiary, isLoading } = useApiary(id!);
  const updateApiary = useUpdateApiary();
  const deleteApiary = useDeleteApiary();
  const loc = useLocation();
  const styles = useStyles(createStyles);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [precision, setPrecision] = useState<LocationPrecision>(
    "approximate",
  );
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (apiary && !initialized) {
      setName(apiary.name ?? "");
      setNotes(apiary.notes ?? "");
      if (apiary.latitude != null) {
        setLatitude(String(apiary.latitude));
      }
      if (apiary.longitude != null) {
        setLongitude(String(apiary.longitude));
      }
      setInitialized(true);
    }
  }, [apiary, initialized]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  async function handleUseGPS() {
    const coords = await loc.getLocation();
    if (coords) {
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
    }
  }

  async function handleLookupAddress() {
    const coords = await loc.geocodeAddress(address);
    if (coords) {
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }

    const rawLat = latitude.trim()
      ? parseFloat(latitude.trim())
      : undefined;
    const rawLng = longitude.trim()
      ? parseFloat(longitude.trim())
      : undefined;
    const lat =
      rawLat !== undefined && !isNaN(rawLat)
        ? roundToPrecision(rawLat, precision)
        : undefined;
    const lng =
      rawLng !== undefined && !isNaN(rawLng)
        ? roundToPrecision(rawLng, precision)
        : undefined;

    // Reverse geocode to derive city from coordinates
    let city: string | undefined;
    if (lat !== undefined && lng !== undefined) {
      city = (await loc.reverseGeocode(lat, lng)) ?? undefined;
    }

    try {
      await updateApiary.mutateAsync({
        id: id!,
        data: {
          name: name.trim(),
          latitude: lat,
          longitude: lng,
          city,
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
    <ScrollView contentContainerStyle={styles.content}>
      <EditApiaryForm
        name={name}
        setName={setName}
        address={address}
        setAddress={setAddress}
        onLookup={handleLookupAddress}
        geocoding={loc.geocoding}
        latitude={latitude}
        setLatitude={setLatitude}
        longitude={longitude}
        setLongitude={setLongitude}
        precision={precision}
        setPrecision={setPrecision}
        notes={notes}
        setNotes={setNotes}
        onUseGPS={handleUseGPS}
        locating={loc.loading}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isPending={updateApiary.isPending}
      />
    </ScrollView>
  );
}
