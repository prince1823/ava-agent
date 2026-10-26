import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";

function BrainGlyph({ size, color }: { size: number; color: string }) {
  const props = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* left hemisphere */}
      <Path
        d="M12 5.2 C10.6 3.5 8.1 3.8 7.1 5.5 C5.4 5.6 4.3 7 4.6 8.6 C3.4 9.5 3.3 11.3 4.3 12.3 C3.7 13.6 4.3 15.2 5.6 15.7 C5.8 17.4 7.3 18.6 8.9 18.2 C9.7 19.4 11.2 19.6 12 18.7"
        {...props}
      />
      {/* right hemisphere */}
      <Path
        d="M12 5.2 C13.4 3.5 15.9 3.8 16.9 5.5 C18.6 5.6 19.7 7 19.4 8.6 C20.6 9.5 20.7 11.3 19.7 12.3 C20.3 13.6 19.7 15.2 18.4 15.7 C18.2 17.4 16.7 18.6 15.1 18.2 C14.3 19.4 12.8 19.6 12 18.7"
        {...props}
      />
      <Path d="M12 5.2 V18.7" {...props} strokeOpacity={0.55} />
      <Path d="M8.2 9.4 C9.4 9.5 10.3 10.2 10.5 11.3 M15.8 9.4 C14.6 9.5 13.7 10.2 13.5 11.3 M8.4 14.3 C9.3 14.1 10.1 13.7 10.5 13 M15.6 14.3 C14.7 14.1 13.9 13.7 13.5 13" {...props} strokeWidth={1.4} />
    </Svg>
  );
}

export function BrainButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button} hitSlop={8} accessibilityLabel="Memory">
      <BrainGlyph size={20} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "#B9A6FF44",
  },
});
