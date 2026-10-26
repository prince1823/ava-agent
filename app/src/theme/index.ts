export const colors = {
  bg: "#0A0812",
  bgElevated: "#15111F",
  surface: "#1B1629",
  surfaceAlt: "#231C35",
  border: "#2E2645",
  textPrimary: "#F5F3FF",
  textSecondary: "#A99FC2",
  textFaint: "#6B6085",
  accent: "#B9A6FF",
  accentSoft: "#2D2250",
  accentGlow: "#C4B5FD",
  // The reference's signature purple-pink-blue gradient trio, for glows/gradients
  // that want to move across the palette rather than sit on one hue.
  accentPink: "#F472B6",
  accentBlue: "#818CF8",
  success: "#4ADE80",
  warning: "#FBBF24",
  danger: "#FB7185",
  bubbleUser: "#B9A6FF",
  bubbleAgent: "#15111F",
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
