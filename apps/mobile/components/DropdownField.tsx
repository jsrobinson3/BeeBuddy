import { useState, useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { useStyles, typography, spacing, radii, type ThemeColors } from "../theme";

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

export interface DropdownSection {
  title: string;
  options: DropdownOption[];
}

interface DropdownFieldProps {
  label: string;
  options: DropdownOption[] | DropdownSection[];
  selected: string;
  onChange: (value: string) => void;
}

function isSections(
  opts: DropdownOption[] | DropdownSection[],
): opts is DropdownSection[] {
  return opts.length > 0 && "title" in opts[0];
}

const createTriggerStyles = (c: ThemeColors) => ({
  trigger: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
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
});

const createMenuStyles = (c: ThemeColors) => ({
  menu: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.selectedBorder,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    backgroundColor: c.bgElevated,
    overflow: "hidden" as const,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: c.border,
  },
});

const createOptionStyles = (c: ThemeColors) => ({
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
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
    marginHorizontal: spacing.md,
  },
});

const createStyles = (c: ThemeColors) => ({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
});

function OptionItem({
  option,
  isSelected,
  isLast,
  onPress,
}: {
  option: DropdownOption;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const s = useStyles(createOptionStyles);
  const pressStyle = ({ pressed }: { pressed: boolean }) => [
    s.option,
    isSelected && s.optionSelected,
    pressed && !isSelected && s.optionPressed,
  ];
  return (
    <>
      <Pressable style={pressStyle} onPress={onPress}>
        <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
          {option.label}
        </Text>
        {option.description && (
          <Text style={s.optionDescription}>{option.description}</Text>
        )}
      </Pressable>
      {!isLast && <View style={s.separator} />}
    </>
  );
}

function flattenOptions(opts: DropdownOption[] | DropdownSection[]): DropdownOption[] {
  if (!isSections(opts)) return opts;
  return opts.flatMap((s) => s.options);
}

function SectionList({
  sections,
  selected,
  onSelect,
}: {
  sections: DropdownSection[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const ms = useStyles(createMenuStyles);
  return (
    <>
      {sections.map((section, sIdx) => (
        <View key={section.title}>
          {sIdx > 0 && <View style={ms.sectionSeparator} />}
          <View style={ms.sectionHeader}>
            <Text style={ms.sectionTitle}>{section.title}</Text>
          </View>
          {section.options.map((option, oIdx) => (
            <OptionItem
              key={option.value}
              option={option}
              isSelected={option.value === selected}
              isLast={sIdx === sections.length - 1 && oIdx === section.options.length - 1}
              onPress={() => onSelect(option.value)}
            />
          ))}
        </View>
      ))}
    </>
  );
}

function FlatOptionList({
  options,
  selected,
  onSelect,
}: {
  options: DropdownOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <>
      {options.map((option, index) => (
        <OptionItem
          key={option.value}
          option={option}
          isSelected={option.value === selected}
          isLast={index === options.length - 1}
          onPress={() => onSelect(option.value)}
        />
      ))}
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
  const ts = useStyles(createTriggerStyles);
  const ms = useStyles(createMenuStyles);
  const [open, setOpen] = useState(false);

  const allOptions = flattenOptions(options);
  const selectedOption = allOptions.find((o) => o.value === selected);
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
        style={[ts.trigger, open && ts.triggerOpen]}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={ts.triggerText}>{displayLabel}</Text>
        <Text style={ts.chevron}>{open ? "\u25B2" : "\u25BC"}</Text>
      </Pressable>
      {open && (
        <View style={ms.menu}>
          {isSections(options)
            ? <SectionList sections={options} selected={selected} onSelect={handleSelect} />
            : <FlatOptionList options={options} selected={selected} onSelect={handleSelect} />}
        </View>
      )}
    </View>
  );
}
