import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface PickerFieldProps {
  label: string;
  options: { label: string; value: string }[];
  selected: string | null;
  onSelect: (val: string | null) => void;
}

const createStyles = (c: ThemeColors) => ({
  pickerLabel: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 16,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: c.bgElevated,
  },
  pickerOptionSelected: {
    borderColor: c.selectedBorder,
    backgroundColor: c.selectedBg,
  },
  pickerOptionText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
  },
  pickerOptionTextSelected: {
    color: c.selectedText,
    fontFamily: typography.families.bodySemiBold,
  },
});

function PickerPill({
  opt,
  isSelected,
  onPress,
  styles,
}: {
  opt: { label: string; value: string };
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
      onPress={onPress}
    >
      <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected]}>
        {opt.label}
      </Text>
    </Pressable>
  );
}

export function PickerField({ label, options, selected, onSelect }: PickerFieldProps) {
  const styles = useStyles(createStyles);
  const pills = options.map((opt) => (
    <PickerPill
      key={opt.value}
      opt={opt}
      isSelected={selected === opt.value}
      onPress={() => onSelect(selected === opt.value ? null : opt.value)}
      styles={styles}
    />
  ));

  return (
    <View>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerRow}>{pills}</View>
    </View>
  );
}
