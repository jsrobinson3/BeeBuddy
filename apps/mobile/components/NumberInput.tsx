import { Pressable, Text, TextInput, View } from "react-native";

import { useStyles, typography, useTheme, type ThemeColors } from "../theme";

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (val: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
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
    alignItems: "center" as const,
    gap: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgElevated,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonText: {
    fontSize: 18,
    fontFamily: typography.families.displaySemiBold,
    color: c.honey,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontFamily: typography.families.body,
    backgroundColor: c.bgInput,
    textAlign: "center" as const,
    color: c.textPrimary,
  },
});

function StepperButton({
  text,
  onPress,
  styles,
}: {
  text: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  );
}

function StepperRow({
  value,
  onDecrement,
  onIncrement,
  onTextChange,
  styles,
  placeholderColor,
}: {
  value: number | null;
  onDecrement: () => void;
  onIncrement: () => void;
  onTextChange: (text: string) => void;
  styles: ReturnType<typeof createStyles>;
  placeholderColor: string;
}) {
  return (
    <View style={styles.row}>
      <StepperButton text="-" onPress={onDecrement} styles={styles} />
      <TextInput
        style={styles.input}
        value={value !== null ? String(value) : ""}
        onChangeText={onTextChange}
        keyboardType="numeric"
        placeholder="--"
        placeholderTextColor={placeholderColor}
      />
      <StepperButton text="+" onPress={onIncrement} styles={styles} />
    </View>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: NumberInputProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  function handleDecrement() {
    const next = (value ?? 0) - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  }

  function handleIncrement() {
    const next = (value ?? 0) + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  }

  function handleTextChange(text: string) {
    if (text === "") {
      onChange(null);
      return;
    }
    const num = Number(text);
    if (isNaN(num)) return;
    if (min !== undefined && num < min) return;
    if (max !== undefined && num > max) return;
    onChange(num);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <StepperRow
        value={value}
        onDecrement={handleDecrement}
        onIncrement={handleIncrement}
        onTextChange={handleTextChange}
        styles={styles}
        placeholderColor={colors.placeholder}
      />
    </View>
  );
}
