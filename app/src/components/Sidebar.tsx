import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { router } from "expo-router";
import { colors, radius, spacing } from "../theme";
import { useAgentStore } from "../store/agentStore";
import { AvaMark } from "./AvaLogo";

const WIDTH = Math.min(320, Dimensions.get("window").width * 0.84);

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function Sidebar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const translateX = useRef(new Animated.Value(-WIDTH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const conversations = useAgentStore((s) => s.conversations);
  const conversationId = useAgentStore((s) => s.conversationId);
  const newConversation = useAgentStore((s) => s.newConversation);
  const switchConversation = useAgentStore((s) => s.switchConversation);
  const removeConversation = useAgentStore((s) => s.removeConversation);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -WIDTH, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panel, { width: WIDTH, transform: [{ translateX }] }]}>
        <View style={styles.brandRow}>
          <AvaMark size={26} />
          <Text style={styles.heading}>Ava</Text>
        </View>

        <Pressable
          style={styles.newChat}
          onPress={() => {
            newConversation();
            onClose();
          }}
        >
          <Text style={styles.newChatText}>+ New chat</Text>
        </Pressable>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {conversations.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.row, c.id === conversationId && styles.rowActive]}
              onPress={() => {
                switchConversation(c.id);
                onClose();
              }}
              onLongPress={() => removeConversation(c.id)}
            >
              <Text numberOfLines={1} style={styles.rowTitle} preserveCase>
                {c.title}
              </Text>
              <Text style={styles.rowTime}>{relativeTime(c.updated_at)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.footerButton}
            onPress={() => {
              onClose();
              router.push("/history");
            }}
          >
            <Text style={styles.footerIcon}>↩️</Text>
            <Text style={styles.footerText}>Activity</Text>
          </Pressable>
          <Pressable
            style={styles.footerButton}
            onPress={() => {
              onClose();
              router.push("/settings");
            }}
          >
            <Text style={styles.footerIcon}>⚙️</Text>
            <Text style={styles.footerText}>Settings</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "#00000055" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bgElevated,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingTop: 18,
    paddingHorizontal: spacing(4),
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing(2.5), marginBottom: spacing(4) },
  heading: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, letterSpacing: 0.5 },
  newChat: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: "center",
    marginBottom: spacing(4),
  },
  newChatText: { color: colors.accent, fontWeight: "600", fontSize: 13 },
  list: { flex: 1 },
  row: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(2),
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  rowActive: { backgroundColor: colors.surface },
  rowTitle: { flex: 1, fontSize: 13, color: colors.textPrimary },
  rowTime: { fontSize: 11, color: colors.textFaint },
  footer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(3),
    gap: spacing(1),
  },
  footerButton: { flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing(1) },
  footerIcon: { fontSize: 14 },
  footerText: { fontSize: 9.5, color: colors.textSecondary },
});
