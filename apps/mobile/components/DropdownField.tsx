import { useState, useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

interface DropdownFieldProps {
  label: string;
  options: DropdownOption[];
  selected: string;
  onChange: (value: string) => void;
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
  trigger: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.bgElevated,
  },
  triggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: c.selectedBorder,
  },
  triggerText: {
    fontSize: 15,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  chevron: {
    fontSize: 12,
    color: c.textSecondary,
  },
  menu: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.selectedBorder,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: c.bgElevated,
    overflow: "hidden" as const,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: c.selectedBg,
  },
  optionPressed: {
    backgroundColor: c.bgInputSoft,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: typography.families.body,
    color: c.textPrimary,
  },
  optionLabelSelected: {
    fontFamily: typography.families.bodySemiBold,
    color: c.selectedText,
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: c.borderLight,
    marginHorizontal: 14,
  },
});

function OptionItem({
  option,
  isSelected,
  isLast,
  onPress,
  styles,
}: {
  option: DropdownOption;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.option,
          isSelected && styles.optionSelected,
          pressed && !isSelected && styles.optionPressed,
        ]}
        onPress={onPress}
      >
        <Text
          style={[
            styles.optionLabel,
            isSelected && styles.optionLabelSelected,
          ]}
        >
          {option.label}
        </Text>
        {option.description && (
          <Text style={styles.optionDescription}>{option.description}</Text>
        )}
      </Pressable>
      {!isLast && <View style={styles.separator} />}
    </>
  );
}

export function DropdownField({
  label,
  options,
  selected,
  onChange,
}: DropdownFieldProps) {
  const styles = useStyles(createStyles);
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === selected);
  const displayLabel = selectedOption?.label ?? selected;

  const handleSelect = useCallback(
    (value: string) => {
      onChange(value);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.trigger, open && styles.triggerOpen]}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={styles.triggerText}>{displayLabel}</Text>
        <Text style={styles.chevron}>{open ? "\u25B2" : "\u25BC"}</Text>
      </Pressable>
      {open && (
        <View style={styles.menu}>
          {options.map((option, index) => (
            <OptionItem
              key={option.value}
              option={option}
              isSelected={option.value === selected}
              isLast={index === options.length - 1}
              onPress={() => handleSelect(option.value)}
              styles={styles}
            />
          ))}
        </View>
      )}
    </View>
  );
}
