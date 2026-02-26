import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { FormInput } from "../../../../components/FormInput";
import { PickerField } from "../../../../components/PickerField";
import {
  useStyles,
  useTheme,
  type ThemeColors,
  typography,
} from "../../../../theme";
import type { LocationPrecision } from "../../../../hooks/useLocation";

/* ---------- Constants ---------- */

const PRECISION_OPTIONS = [
  { label: "Exact (~11 m)", value: "exact" },
  { label: "Approximate (~1 km)", value: "approximate" },
  { label: "General area (~11 km)", value: "general" },
];

const PRECISION_HINTS: Record<LocationPrecision, string> = {
  exact: "Full precision stored. Best for your own records.",
  approximate:
    "Rounded to ~1 km. Hides your exact address.",
  general:
    "Rounded to ~11 km. Only the general region is stored.",
};

/* ---------- Styles ---------- */

const createAddressStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    gap: 8,
    alignItems: "flex-end" as const,
    marginBottom: 16,
  },
  input: { flex: 1 as const, marginBottom: 0 },
  lookupBtn: {
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  lookupText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
});

const createGpsStyles = (c: ThemeColors) => ({
  btn: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.honey,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
  },
  btnText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

const createCoordStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 16,
  },
  field: { flex: 1 as const, marginBottom: 0 },
});

const createHintStyles = (c: ThemeColors) => ({
  hint: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginTop: -8,
    marginBottom: 16,
  },
});

/* ---------- AddressLookup ---------- */

export function AddressLookup({
  address,
  setAddress,
  onLookup,
  geocoding,
}: {
  address: string;
  setAddress: (v: string) => void;
  onLookup: () => void;
  geocoding: boolean;
}) {
  const s = useStyles(createAddressStyles);
  const { colors } = useTheme();
  const btnContent = geocoding
    ? <ActivityIndicator size="small" color={colors.textPrimary} />
    : <Text style={s.lookupText}>Look Up</Text>;

  return (
    <View style={s.row}>
      <FormInput
        label="Address or Place"
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. 123 Main St, Portland OR"
        containerStyle={s.input}
      />
      <Pressable
        style={s.lookupBtn}
        onPress={onLookup}
        disabled={geocoding || !address.trim()}
      >
        {btnContent}
      </Pressable>
    </View>
  );
}

/* ---------- GPSButton ---------- */

export function GPSButton({
  onPress,
  locating,
}: {
  onPress: () => void;
  locating: boolean;
}) {
  const s = useStyles(createGpsStyles);
  const { colors } = useTheme();
  const content = locating
    ? <ActivityIndicator size="small" color={colors.honey} />
    : <Text style={s.btnText}>Use My Location</Text>;

  return (
    <Pressable style={s.btn} onPress={onPress} disabled={locating}>
      {content}
    </Pressable>
  );
}

/* ---------- LatLngRow ---------- */

export function LatLngRow({
  latitude,
  setLatitude,
  longitude,
  setLongitude,
}: {
  latitude: string;
  setLatitude: (v: string) => void;
  longitude: string;
  setLongitude: (v: string) => void;
}) {
  const s = useStyles(createCoordStyles);
  return (
    <View style={s.row}>
      <FormInput
        label="Latitude"
        value={latitude}
        onChangeText={setLatitude}
        placeholder="e.g. -33.8688"
        keyboardType="numeric"
        containerStyle={s.field}
      />
      <FormInput
        label="Longitude"
        value={longitude}
        onChangeText={setLongitude}
        placeholder="e.g. 151.2093"
        keyboardType="numeric"
        containerStyle={s.field}
      />
    </View>
  );
}

/* ---------- PrecisionPicker ---------- */

export function PrecisionPicker({
  precision,
  setPrecision,
}: {
  precision: LocationPrecision;
  setPrecision: (v: LocationPrecision) => void;
}) {
  const s = useStyles(createHintStyles);
  return (
    <>
      <PickerField
        label="Location Precision"
        options={PRECISION_OPTIONS}
        selected={precision}
        onSelect={(v) => v && setPrecision(v as LocationPrecision)}
      />
      <Text style={s.hint}>{PRECISION_HINTS[precision]}</Text>
    </>
  );
}
