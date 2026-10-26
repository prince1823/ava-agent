import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";

export function NewChatButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button} hitSlop={8} accessibilityLabel="New chat">
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
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
