import { Switch, Text, View } from "react-native";

import { useStyles, typography, useTheme, type ThemeColors } from "../theme";

interface BooleanToggleProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: 10,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
  },
});

export function BooleanToggle({ label, value, onValueChange }: BooleanToggleProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
        thumbColor={colors.switchThumb}
      />
    </View>
  );
}
