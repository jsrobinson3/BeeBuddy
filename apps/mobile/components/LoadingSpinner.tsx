import { ActivityIndicator, View } from "react-native";

import { useStyles, useTheme, type ThemeColors } from "../theme";

interface LoadingSpinnerProps {
  fullscreen?: boolean;
}

const createStyles = (c: ThemeColors) => ({
  fullscreen: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.bgPrimary,
  },
});

export function LoadingSpinner({ fullscreen }: LoadingSpinnerProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  if (fullscreen) {
    return (
      <View style={styles.fullscreen}>
        <ActivityIndicator size="large" color={colors.honey} />
      </View>
    );
  }

  return <ActivityIndicator size="large" color={colors.honey} />;
}
