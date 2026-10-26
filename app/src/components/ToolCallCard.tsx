import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { toolIcon, toolLabel } from "../tools/presentation";
import type { ToolCall } from "../types/agent";

export function ToolCallCard({ call }: { call: ToolCall }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (call.status !== "running") return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [call.status, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.card, statusStyle(call.status)]}>
      <View style={styles.row}>
        {call.status === "running" ? (
          <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>⟳</Animated.Text>
        ) : (
          <Text style={styles.icon}>{toolIcon(call.name)}</Text>
        )}
        <Text style={styles.label}>{toolLabel(call.name)}</Text>
        <StatusBadge status={call.status} />
      </View>
      {call.status === "error" && call.error ? <Text style={styles.error}>{call.error}</Text> : null}
      {call.status === "declined" ? <Text style={styles.declined}>Declined by you</Text> : null}
    </View>
  );
}

function StatusBadge({ status }: { status: ToolCall["status"] }) {
  const map: Record<ToolCall["status"], string> = {
    running: "Working…",
    awaiting_confirmation: "Needs OK",
    done: "Done",
    declined: "Declined",
    error: "Failed",
  };
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{map[status]}</Text>
    </View>
  );
}

function statusStyle(status: ToolCall["status"]) {
  switch (status) {
    case "done":
      return { borderColor: colors.success + "55" };
    case "error":
      return { borderColor: colors.danger + "55" };
    case "declined":
      return { borderColor: colors.textFaint };
    case "awaiting_confirmation":
      return { borderColor: colors.warning + "55" };
    default:
      return { borderColor: colors.accent + "55" };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    marginTop: spacing(2),
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  icon: { fontSize: 14, width: 18, textAlign: "center" },
  label: { flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  badge: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, color: colors.textSecondary, fontWeight: "600", letterSpacing: 0.2 },
  error: { color: colors.danger, fontSize: 11 },
  declined: { color: colors.textFaint, fontSize: 11 },
});
