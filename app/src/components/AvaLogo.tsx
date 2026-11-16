import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme";

export function AvaMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="avaMark" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#5B4FCF" />
          <Stop offset="0.5" stopColor="#B9A6FF" />
          <Stop offset="1" stopColor="#F472B6" />
        </LinearGradient>
      </Defs>
      <Circle cx="21" cy="26" r="15" fill="url(#avaMark)" opacity={0.92} />
      <Circle cx="38" cy="38" r="12" fill="url(#avaMark)" opacity={0.75} />
    </Svg>
  );
}

const STATUS_COLOR: Record<string, string> = {
  open: "#B9A6FF",
  connecting: colors.warning,
  closed: colors.danger,
  error: colors.danger,
};

export function AvaBrand({ status }: { status?: string }) {
  return (
    <View style={styles.row}>
      <View>
        <AvaMark size={28} />
        {status ? <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] ?? colors.danger }]} /> : null}
      </View>
      <Text style={styles.word}>AVA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { position: "absolute", right: -2, bottom: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.bg },
  word: { color: colors.textPrimary, fontSize: 17, fontWeight: "800", letterSpacing: 1 },
});
