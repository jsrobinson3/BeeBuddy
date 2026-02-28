/**
 * Web-platform override for DatePickerField.
 *
 * Uses a hidden native HTML <input type="date"> to trigger the browser's
 * built-in date picker instead of @react-native-community/datetimepicker
 * which has no web support.
 *
 * The component interface and visual appearance are identical to the native
 * version.
 */

import { useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

// ── Types ───────────────────────────────────────────────────────────

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

// ── Styles ──────────────────────────────────────────────────────────

const createContainerStyles = (c: ThemeColors) => ({
  container: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: 4,
  },
  field: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: c.bgInput,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
});

const createTextStyles = (c: ThemeColors) => ({
  fieldText: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
  },
  placeholder: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.placeholder,
  },
  clearText: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.danger,
    paddingLeft: 8,
  },
});

const createStyles = (c: ThemeColors) => ({
  ...createContainerStyles(c),
  ...createTextStyles(c),
});

// ── Constants ───────────────────────────────────────────────────────

/** Visually hidden style for the native HTML date input. */
const HIDDEN_INPUT_STYLE: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD for the HTML input's `value` attribute. */
function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a Date for user-facing display (e.g. "Feb 27, 2026"). */
function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Try to open the browser's native date picker via showPicker(), falling
 * back to focus+click for older browsers.
 */
function triggerPicker(el: HTMLInputElement): void {
  if (typeof el.showPicker === "function") {
    try { el.showPicker(); return; } catch { /* fall through */ }
  }
  el.focus();
  el.click();
}

// ── Sub-components ──────────────────────────────────────────────────

function FieldContent({
  value,
  placeholder,
  onClear,
  styles,
}: {
  value: Date | null;
  placeholder: string;
  onClear: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!value) {
    return <Text style={styles.placeholder}>{placeholder}</Text>;
  }
  return (
    <>
      <Text style={styles.fieldText}>{formatDisplay(value)}</Text>
      <Pressable onPress={onClear} hitSlop={8}>
        <Text style={styles.clearText}>Clear</Text>
      </Pressable>
    </>
  );
}

/** Pressable row that displays the current value or placeholder. */
function DateField({
  value,
  placeholder,
  onClear,
  onPress,
  styles,
}: {
  value: Date | null;
  placeholder: string;
  onClear: () => void;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.field} onPress={onPress}>
      <FieldContent value={value} placeholder={placeholder} onClear={onClear} styles={styles} />
    </Pressable>
  );
}

/** Hidden HTML date input that triggers the browser's built-in picker. */
function HiddenDateInput({
  inputRef,
  value,
  onChangeDate,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: Date | null;
  onChangeDate: (date: Date | null) => void;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const dateStr = e.target.value;
    if (!dateStr) { onChangeDate(null); return; }
    const [y, m, d] = dateStr.split("-").map(Number);
    onChangeDate(new Date(y, m - 1, d, 12, 0, 0));
  }

  return (
    <input
      ref={inputRef}
      type="date"
      value={value ? toInputValue(value) : ""}
      onChange={handleChange}
      style={HIDDEN_INPUT_STYLE}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}

// ── Component ───────────────────────────────────────────────────────

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
}: DatePickerFieldProps) {
  const styles = useStyles(createStyles);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (inputRef.current) triggerPicker(inputRef.current);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <DateField
        value={value}
        placeholder={placeholder}
        onClear={() => onChange(null)}
        onPress={openPicker}
        styles={styles}
      />
      <HiddenDateInput inputRef={inputRef} value={value} onChangeDate={onChange} />
    </View>
  );
}
