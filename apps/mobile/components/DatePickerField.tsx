import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useStyles, typography, type ThemeColors } from "../theme";

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: 4,
  },
  field: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: c.bgInput,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  fieldText: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
  },
  placeholder: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.placeholder,
  },
  clearText: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.danger,
    paddingLeft: 8,
  },
});

function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FieldContent({ value, placeholder, onClear, styles }: {
  value: Date | null;
  placeholder: string;
  onClear: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!value) {
    return <Text style={styles.placeholder}>{placeholder}</Text>;
  }
  return (
    <>
      <Text style={styles.fieldText}>{formatDisplay(value)}</Text>
      <Pressable onPress={onClear} hitSlop={8}>
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>
    </>
  );
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
}: DatePickerFieldProps) {
  const styles = useStyles(createStyles);
  const [show, setShow] = useState(false);

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setShow(false);
    }
    if (selected) {
      onChange(selected);
    }
  }

  const pickerDisplay = Platform.OS === "ios" ? "inline" : "default";
  const picker = show ? (
    <DateTimePicker
      value={value ?? new Date()}
      mode="date"
      display={pickerDisplay}
      onChange={handleChange}
    />
  ) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setShow(true)}>
        <FieldContent value={value} placeholder={placeholder} onClear={() => onChange(null)} styles={styles} />
      </Pressable>
      {picker}
    </View>
  );
}
