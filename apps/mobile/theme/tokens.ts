/** Design tokens that do NOT change between light/dark mode. */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  pill: 9999,
  full: 9999,
} as const;

export const typography = {
  families: {
    display: "PlusJakartaSans-ExtraBold",
    displayBold: "PlusJakartaSans-Bold",
    displaySemiBold: "PlusJakartaSans-SemiBold",
    body: "Inter-Regular",
    bodyMedium: "Inter-Medium",
    bodySemiBold: "Inter-SemiBold",
    bodyBold: "Inter-Bold",
    mono: "JetBrainsMono-Regular",
  },
  sizes: {
    h1: { fontSize: 32, lineHeight: 38 },
    h2: { fontSize: 26, lineHeight: 33 },
    h3: { fontSize: 20, lineHeight: 26 },
    h4: { fontSize: 16, lineHeight: 22 },
    body: { fontSize: 16, lineHeight: 24 },
    bodySm: { fontSize: 14, lineHeight: 21 },
    caption: { fontSize: 12, lineHeight: 17 },
    overline: { fontSize: 11, lineHeight: 18 },
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#3f4a30",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHover: {
    shadowColor: "#3f4a30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  fab: {
    shadowColor: "#3f4a30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
} as const;
