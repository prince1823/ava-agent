import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, radius, spacing } from "../theme";
import { toolConfirmationCopy, toolIcon } from "../tools/presentation";
import { useAgentStore } from "../store/agentStore";
import { listCalendarEvents } from "../tools/calendar";

export function ConfirmSheet() {
  const pending = useAgentStore((s) => s.pendingConfirmation);
  const confirmPending = useAgentStore((s) => s.confirmPending);
  const translateY = useRef(new Animated.Value(300)).current;
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: pending ? 0 : 300,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [pending, translateY]);

  useEffect(() => {
    setConflict(null);
    if (pending?.name !== "create_calendar_event") return;
    const { start, end } = pending.args;
    if (!start || !end) return;

    let cancelled = false;
    listCalendarEvents({ start, end })
      .then((events) => {
        if (cancelled || events.length === 0) return;
        const names = events.map((e) => e.title).join(", ");
        setConflict(`⚠️ Overlaps with: ${names}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pending]);

  if (!pending) return null;
  const copy = toolConfirmationCopy(pending.name, pending.args);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => confirmPending(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => confirmPending(false)} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.icon}>{toolIcon(pending.name)}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          {copy.body ? <Text style={styles.body}>{copy.body}</Text> : null}
          {conflict ? <Text style={styles.conflict}>{conflict}</Text> : null}
          <Text style={styles.caveat}>Ava wants to take this real action on your device.</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.decline]} onPress={() => confirmPending(false)}>
              <Text style={styles.declineText}>Not now</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.approve]} onPress={() => confirmPending(true)}>
              <Text style={styles.approveText}>Confirm</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(6),
    paddingTop: spacing(3),
    paddingBottom: spacing(10),
    borderTopWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing(2),
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing(2) },
  icon: { fontSize: 30 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: "600", textAlign: "center" },
  body: { color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
  conflict: {
    color: colors.warning,
    fontSize: 12,
    textAlign: "center",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.sm,
  },
  caveat: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing(1) },
  actions: { flexDirection: "row", gap: spacing(3), width: "100%", marginTop: spacing(4) },
  button: { flex: 1, paddingVertical: spacing(3.5), borderRadius: radius.md, alignItems: "center" },
  decline: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.textSecondary, fontWeight: "700" },
  approve: { backgroundColor: colors.accent },
  approveText: { color: "#FFFFFF", fontWeight: "700" },
});
