import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

import { useStyles, typography, useTheme, type ThemeColors } from "../theme";

interface FormInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  label: string;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
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
  input: {
    borderWidth: 0,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: typography.families.body,
    backgroundColor: c.bgInputSoft,
    color: c.textPrimary,
  },
  inputError: {
    borderColor: c.danger,
  },
  error: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.danger,
    marginTop: 4,
  },
});

export function FormInput({
  label,
  error,
  value,
  onChangeText,
  ...rest
}: FormInputProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.placeholder}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
