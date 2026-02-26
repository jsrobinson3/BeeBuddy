import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";

import { useCreateApiary } from "../../../../hooks/useApiaries";
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
import { CreateApiaryForm } from "./_CreateApiaryForm";

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
});

export default function CreateApiaryScreen() {
  const router = useRouter();
  const createApiary = useCreateApiary();
  const loc = useLocation();
  const styles = useStyles(createStyles);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [precision, setPrecision] = useState<LocationPrecision>("approximate");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();

  function handleNameChange(text: string) {
    setName(text);
    if (nameError) setNameError(undefined);
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
      setNameError("Name is required");
      return;
    }
    setNameError(undefined);

    const rawLat = latitude.trim() ? parseFloat(latitude.trim()) : undefined;
    const rawLng = longitude.trim() ? parseFloat(longitude.trim()) : undefined;
    const lat =
      rawLat !== undefined && !isNaN(rawLat)
        ? roundToPrecision(rawLat, precision)
        : undefined;
    const lng =
      rawLng !== undefined && !isNaN(rawLng)
        ? roundToPrecision(rawLng, precision)
        : undefined;

    let city: string | undefined;
    if (lat !== undefined && lng !== undefined) {
      city = (await loc.reverseGeocode(lat, lng)) ?? undefined;
    }

    try {
      await createApiary.mutateAsync({
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        city,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CreateApiaryForm
        name={name}
        setName={handleNameChange}
        nameError={nameError}
        address={address}
        setAddress={setAddress}
        onLookup={handleLookupAddress}
        geocoding={loc.geocoding}
        onUseGPS={handleUseGPS}
        locating={loc.loading}
        latitude={latitude}
        setLatitude={setLatitude}
        longitude={longitude}
        setLongitude={setLongitude}
        precision={precision}
        setPrecision={setPrecision}
        notes={notes}
        setNotes={setNotes}
        onSubmit={handleSubmit}
        isPending={createApiary.isPending}
      />
    </ScrollView>
  );
}
