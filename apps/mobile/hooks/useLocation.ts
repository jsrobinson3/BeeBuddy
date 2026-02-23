import { useCallback, useState } from "react";
import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";

interface LocationResult {
  latitude: number;
  longitude: number;
}

export type LocationPrecision = "exact" | "approximate" | "general";

/** Decimal places per precision level. */
const PRECISION_DECIMALS: Record<LocationPrecision, number> = {
  exact: 4,       // ~11 m
  approximate: 2, // ~1.1 km
  general: 1,     // ~11 km
};

/** Round a coordinate to the number of decimals dictated by precision. */
export function roundToPrecision(value: number, precision: LocationPrecision): number {
  const d = PRECISION_DECIMALS[precision];
  const factor = Math.pow(10, d);
  return Math.round(value * factor) / factor;
}

export function useLocation() {
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

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
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      Alert.alert("Location Error", "Could not determine your location. Please enter coordinates manually.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const geocodeAddress = useCallback(async (address: string): Promise<LocationResult | null> => {
    if (!address.trim()) return null;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(address.trim());
      if (results.length === 0) {
        Alert.alert("Not Found", "Could not find coordinates for that address. Try a more specific address or city name.");
        return null;
      }
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    } catch {
      Alert.alert("Geocoding Error", "Could not look up that address. Please enter coordinates manually.");
      return null;
    } finally {
      setGeocoding(false);
    }
  }, []);

  return { getLocation, geocodeAddress, loading, geocoding };
}
