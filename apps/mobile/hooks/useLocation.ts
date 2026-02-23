import { useCallback, useState } from "react";
import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";

interface LocationResult {
  latitude: number;
  longitude: number;
}

/**
 * Hook for requesting device location permission and fetching current coordinates.
 *
 * Returns a `getLocation` function that handles permission prompts and returns
 * lat/lng, plus a `loading` flag for UI feedback.
 */
export function useLocation() {
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(async (): Promise<LocationResult | null> => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "BeeBuddy needs location access to auto-fill your apiary coordinates. You can enable it in Settings.",
          Platform.OS === "ios"
            ? [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]
            : [{ text: "OK" }],
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: Math.round(position.coords.latitude * 10000) / 10000,
        longitude: Math.round(position.coords.longitude * 10000) / 10000,
      };
    } catch {
      Alert.alert("Location Error", "Could not determine your location. Please enter coordinates manually.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getLocation, loading };
}
