import { typography, type ThemeColors } from "../../theme";

export const createScannerStyles = (c: ThemeColors) => ({
  container: { marginBottom: 12 },
  scanButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.honey,
  },
  scanButtonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    marginTop: 4,
  },
  infoButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 4,
  },
  infoText: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.textMuted,
  },
});

export const createProcessingStyles = (c: ThemeColors) => ({
  overlay: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center" as const,
    gap: 16,
  },
  text: {
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
});

export const createShellStyles = (c: ThemeColors) => ({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end" as const,
  },
  sheet: {
    backgroundColor: c.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%" as const,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  closeButton: { padding: 4 },
});

export const createReviewStyles = (c: ThemeColors) => ({
  content: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  rawTextBox: {
    backgroundColor: c.bgInput,
    borderRadius: 8,
    padding: 12,
    maxHeight: 120,
  },
  rawText: {
    fontSize: 13,
    fontFamily: typography.families.mono,
    color: c.textPrimary,
    lineHeight: 20,
  },
  actions: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  applyButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
  },
  applyText: {
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
    color: c.textOnPrimary,
  },
  retryButton: { alignItems: "center" as const, padding: 10 },
  retryText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.honey,
  },
});

export const createFieldRowStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 6,
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textPrimary,
  },
  value: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeHigh: { backgroundColor: c.success + "20" },
  badgeMedium: { backgroundColor: c.honey + "20" },
  badgeLow: { backgroundColor: c.warning + "20" },
});

export const createSourceStyles = (c: ThemeColors) => ({
  buttonRow: {
    flexDirection: "row" as const,
    gap: 8,
    padding: 20,
  },
  button: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.honey,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

export const createTemplateStyles = (c: ThemeColors) => ({
  sheet: {
    backgroundColor: c.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "70%" as const,
  },
  text: {
    fontSize: 13,
    fontFamily: typography.families.mono,
    color: c.textPrimary,
    lineHeight: 22,
  },
});

export const FIELD_LABELS: Record<string, string> = {
  queenSeen: "Queen Seen",
  eggsSeen: "Eggs Seen",
  larvaeSeen: "Larvae Seen",
  cappedBrood: "Capped Brood",
  populationEstimate: "Population",
  honeyStores: "Honey Stores",
  temperament: "Temperament",
  pollenStores: "Pollen Stores",
  broodPatternScore: "Brood Pattern",
  framesOfBees: "Frames of Bees",
  framesOfBrood: "Frames of Brood",
  pestSigns: "Pest Signs",
  diseaseSigns: "Disease Signs",
  varroaCount: "Varroa Count",
  numSupers: "Supers",
  impression: "Impression",
  attention: "Needs Attention",
  durationMinutes: "Duration",
  tempC: "Temperature",
  humidityPercent: "Humidity",
  conditions: "Conditions",
  inspectedAt: "Date",
};
