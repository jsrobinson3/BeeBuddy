import { FormInput } from "../../../../components/FormInput";
import { FormActionButton } from "../../../../components/FormActionButton";
import type { LocationPrecision } from "../../../../hooks/useLocation";
import {
  useStyles,
  type ThemeColors,
  formSubmitStyles,
} from "../../../../theme";
import {
  AddressLookup,
  GPSButton,
  LatLngRow,
  PrecisionPicker,
} from "./_LocationFields";

const createStyles = (c: ThemeColors) => ({
  ...formSubmitStyles(c),
});

interface CreateApiaryFormProps {
  name: string;
  setName: (v: string) => void;
  nameError?: string;
  address: string;
  setAddress: (v: string) => void;
  onLookup: () => void;
  geocoding: boolean;
  onUseGPS: () => void;
  locating: boolean;
  latitude: string;
  setLatitude: (v: string) => void;
  longitude: string;
  setLongitude: (v: string) => void;
  precision: LocationPrecision;
  setPrecision: (v: LocationPrecision) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CreateApiaryForm(props: CreateApiaryFormProps) {
  const s = useStyles(createStyles);

  return (
    <>
      <FormInput
        label="Name"
        value={props.name}
        onChangeText={props.setName}
        error={props.nameError}
        placeholder="e.g. Home Apiary"
        autoFocus
      />
      <AddressLookup
        address={props.address}
        setAddress={props.setAddress}
        onLookup={props.onLookup}
        geocoding={props.geocoding}
      />
      <GPSButton onPress={props.onUseGPS} locating={props.locating} />
      <LatLngRow
        latitude={props.latitude}
        setLatitude={props.setLatitude}
        longitude={props.longitude}
        setLongitude={props.setLongitude}
      />
      <PrecisionPicker
        precision={props.precision}
        setPrecision={props.setPrecision}
      />
      <FormInput
        label="Notes"
        value={props.notes}
        onChangeText={props.setNotes}
        placeholder="Optional notes..."
        multiline
        numberOfLines={4}
        style={{ textAlignVertical: "top", minHeight: 100 }}
      />
      <FormActionButton
        label={props.isPending ? "Creating..." : "Create Apiary"}
        onPress={props.onSubmit}
        disabled={props.isPending}
        style={[s.submitButton, props.isPending && s.submitDisabled]}
        textStyle={s.submitText}
      />
    </>
  );
}
