import React from "react";
import { TextInput } from "react-native";

import {
  useStyles,
  useTheme,
  typography,
  radii,
  type ThemeColors,
} from "../../theme";

const createInputStyles = (c: ThemeColors) => ({
  input: {
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    padding: 16,
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    marginBottom: 12,
  },
});

export function AuthInput(props: React.ComponentProps<typeof TextInput>) {
  const s = useStyles(createInputStyles);
  const { colors } = useTheme();
  return (
    <TextInput
      style={s.input}
      placeholderTextColor={colors.placeholder}
      {...props}
    />
  );
}
