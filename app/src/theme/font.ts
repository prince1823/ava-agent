import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";

// A free, open-license geometric sans standing in for a proprietary brand
// typeface we can't legally bundle — same spirit (grotesque, geometric,
// slightly technical), none of the licensing risk. Applied app-wide via the
// Text/TextInput wrapper in src/components/Text.tsx.
export const FONT_WEIGHTS = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  semibold: "SpaceGrotesk_600SemiBold",
  bold: "SpaceGrotesk_700Bold",
} as const;

export const fontsToLoad = {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
};
