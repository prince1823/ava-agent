import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export function LockScreen({ onUnlock, error }: { onUnlock: () => void; error?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Ava is locked</Text>
      <Text style={styles.subtitle}>Your calendar, contacts, and expenses are protected.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onUnlock}>
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: spacing(2) },
  icon: { fontSize: 40, marginBottom: spacing(2) },
  title: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", paddingHorizontal: spacing(10) },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing(1) },
  button: {
    marginTop: spacing(5),
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(8),
  },
  buttonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
});
