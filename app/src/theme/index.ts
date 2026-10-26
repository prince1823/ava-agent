export const colors = {
  bg: "#0A1612",
  bgElevated: "#0F1F1A",
  surface: "#152B24",
  surfaceAlt: "#1B372E",
  border: "#1F3A32",
  textPrimary: "#F2FFF9",
  textSecondary: "#8FB3A6",
  textFaint: "#5B7A6E",
  accent: "#38E2A4",
  accentSoft: "#163F31",
  accentGlow: "#5BF0BA",
  success: "#38E2A4",
  warning: "#F5C56B",
  danger: "#FF6B81",
  bubbleUser: "#38E2A4",
  bubbleAgent: "#0F1F1A",
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
  pill: 999,
};

export const spacing = (n: number) => n * 4;

export const typography = {
  display: { fontSize: 26, fontWeight: "800" as const, color: colors.textPrimary, letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: "700" as const, color: colors.textPrimary },
  body: { fontSize: 14, fontWeight: "400" as const, color: colors.textPrimary },
  caption: { fontSize: 11, fontWeight: "600" as const, color: colors.textSecondary, letterSpacing: 0.4 },
  mono: { fontSize: 11, fontWeight: "500" as const, color: colors.textSecondary, fontFamily: "Courier" },
};
