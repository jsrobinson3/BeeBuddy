import { Pressable, ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { useStyles, type ThemeColors } from "../theme";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

const createStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export function Card({ children, onPress, style }: CardProps) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.card, style]}
      onPress={onPress}
      disabled={!onPress}
    >
      {children}
    </Pressable>
  );
}
