import { Pressable, Text } from "react-native";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";

interface FormActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function FormActionButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
}: FormActionButtonProps) {
  return (
    <Pressable style={style} onPress={onPress} disabled={disabled}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
