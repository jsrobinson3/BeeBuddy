import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: c.bgElevated,
  },
  pillSelected: {
    borderColor: c.selectedBorder,
    backgroundColor: c.selectedBg,
  },
  pillText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
  },
  pillTextSelected: {
    color: c.selectedText,
    fontFamily: typography.families.bodySemiBold,
  },
});

function Pill({
  option,
  isSelected,
  onPress,
  styles,
}: {
  option: string;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.pill, isSelected && styles.pillSelected]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
        {option.replace(/_/g, " ")}
      </Text>
    </Pressable>
  );
}

function PillRow({
  options,
  selected,
  onPress,
  styles,
}: {
  options: string[];
  selected: string[];
  onPress: (option: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const pills = options.map((option) => (
    <Pill
      key={option}
      option={option}
      isSelected={selected.includes(option)}
      onPress={() => onPress(option)}
      styles={styles}
    />
  ));

  return <View style={styles.row}>{pills}</View>;
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const styles = useStyles(createStyles);

  function handlePress(option: string) {
    if (option === "none") {
      onChange(selected.includes("none") ? [] : ["none"]);
      return;
    }
    const withoutNone = selected.filter((s) => s !== "none");
    if (withoutNone.includes(option)) {
      onChange(withoutNone.filter((s) => s !== option));
    } else {
      onChange([...withoutNone, option]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PillRow options={options} selected={selected} onPress={handlePress} styles={styles} />
    </View>
  );
}
