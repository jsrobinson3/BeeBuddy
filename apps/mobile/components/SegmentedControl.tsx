import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface SegmentedControlProps {
  options: string[];
  selected: string;
  onChange: (val: string) => void;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: "row" as const,
    borderRadius: 9999,
    backgroundColor: c.bgInputSoft,
    overflow: "hidden" as const,
    marginBottom: 16,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center" as const,
    borderRadius: 9999,
    backgroundColor: "transparent",
  },
  segmentSelected: {
    backgroundColor: c.primaryFill,
  },
  segmentPressed: {
    backgroundColor: c.bgElevated,
  },
  text: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textSecondary,
  },
  textSelected: {
    color: c.textOnPrimary,
    fontFamily: typography.families.bodySemiBold,
  },
});

function Segment({
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
      style={({ pressed }) => [
        styles.segment,
        isSelected && styles.segmentSelected,
        pressed && !isSelected && styles.segmentPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.text, isSelected && styles.textSelected]}>
        {option}
      </Text>
    </Pressable>
  );
}

function SegmentRow({
  options,
  selected,
  onChange,
  styles,
}: {
  options: string[];
  selected: string;
  onChange: (val: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const segments = options.map((option) => (
    <Segment
      key={option}
      option={option}
      isSelected={option === selected}
      onPress={() => onChange(option)}
      styles={styles}
    />
  ));

  return <View style={styles.container}>{segments}</View>;
}

export function SegmentedControl({ options, selected, onChange }: SegmentedControlProps) {
  const styles = useStyles(createStyles);
  return (
    <SegmentRow options={options} selected={selected} onChange={onChange} styles={styles} />
  );
}
