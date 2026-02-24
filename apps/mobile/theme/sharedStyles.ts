/** Reusable style fragments for picker chips and form submit buttons. */

import type { ThemeColors } from "./themes";
import { typography } from "./tokens";

export const pickerStyles = (c: ThemeColors) => ({
  pickerLabel: {
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 16,
  },
  pickerOption: {
    borderWidth: 0,
    borderColor: c.border,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: c.bgInputSoft,
  },
  pickerOptionSelected: {
    borderColor: c.selectedBorder,
    backgroundColor: c.selectedBg,
  },
  pickerOptionText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
  },
  pickerOptionTextSelected: {
    color: c.selectedText,
    fontFamily: typography.families.bodySemiBold,
  },
});

export const formSubmitStyles = (c: ThemeColors) => ({
  submitButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 16,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

export const formDeleteStyles = (c: ThemeColors) => ({
  deleteButton: {
    backgroundColor: "transparent" as const,
    borderRadius: 16,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.danger,
  },
  deleteText: {
    color: c.danger,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

export const formContainerStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  content: {
    padding: 16,
  },
});

export const errorStyles = (c: ThemeColors) => ({
  errorText: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.danger,
    marginBottom: 8,
  },
});
