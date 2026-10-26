import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme";

export function AvaMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="avaMark" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C9FFEB" />
          <Stop offset="0.5" stopColor="#38E2A4" />
          <Stop offset="1" stopColor="#0E7A58" />
        </LinearGradient>
      </Defs>
      <Circle cx="16" cy="16" r="15.2" fill="url(#avaMark)" />
      <Circle cx="16" cy="16" r="15.2" fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={0.8} />
      <Path
        d="M16 5.5 C16.9 12 20 15.1 26.5 16 C20 16.9 16.9 20 16 26.5 C15.1 20 12 16.9 5.5 16 C12 15.1 15.1 12 16 5.5 Z"
        fill="#07140F"
      />
      <Circle cx="24" cy="8.2" r="1.5" fill="#07140F" />
    </Svg>
  );
}

const STATUS_COLOR: Record<string, string> = {
  open: "#38E2A4",
  connecting: "#F5C56B",
  closed: "#FF6B81",
  error: "#FF6B81",
};

export function AvaBrand({ status }: { status?: string }) {
  return (
    <View style={styles.row}>
      <View>
        <AvaMark size={28} />
        {status ? <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] ?? "#FF6B81" }]} /> : null}
      </View>
      <Text style={styles.word}>AVA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { position: "absolute", right: -2, bottom: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#0A1612" },
  word: { color: colors.textPrimary, fontSize: 19, fontWeight: "800", letterSpacing: 5 },
});
