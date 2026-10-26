import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { useAgentStore } from "../store/agentStore";

const COPY: Record<string, { label: string; color: string }> = {
  connecting: { label: "Connecting…", color: colors.warning },
  open: { label: "Live", color: colors.success },
  closed: { label: "Offline", color: colors.danger },
  error: { label: "Connection error", color: colors.danger },
};

export function ConnectionBadge() {
  const status = useAgentStore((s) => s.status);
  const info = COPY[status] ?? COPY.closed;

  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <Text style={styles.text}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
});
