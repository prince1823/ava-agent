import React, { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors, radius, spacing } from "../theme";

const ORB = 132;

export function VoiceOverlay({
  visible,
  level,
  transcript,
  listening,
  onCancel,
  onSend,
}: {
  visible: boolean;
  level: Animated.Value;
  transcript: string;
  listening: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, breathe]);

  const idle = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const orbScale = Animated.add(idle, Animated.multiply(level, 0.45));
  const ring1Scale = Animated.add(1.15, Animated.multiply(level, 0.9));
  const ring2Scale = Animated.add(1.35, Animated.multiply(level, 1.4));
  const ring1Opacity = Animated.subtract(0.5, Animated.multiply(level, 0.2));
  const ring2Opacity = Animated.subtract(0.28, Animated.multiply(level, 0.12));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Text style={styles.status}>{listening ? "Listening…" : "Tap send when you're ready"}</Text>
        <Text style={styles.transcript} numberOfLines={5}>
          {transcript || "Say something"}
        </Text>

        <View style={styles.orbArea}>
          <Animated.View style={[styles.ring, { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />
          <Animated.View style={[styles.ring, { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] }]} />
          <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="orbGrad" cx="40%" cy="35%" r="75%">
                  <Stop offset="0%" stopColor="#B8FFE6" stopOpacity={1} />
                  <Stop offset="55%" stopColor="#38E2A4" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#0E7A58" stopOpacity={1} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#orbGrad)" />
            </Svg>
          </Animated.View>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.cancel]} onPress={onCancel}>
            <Text style={styles.cancelText}>✕</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.send]} onPress={onSend}>
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#050C09F2",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing(12),
    paddingHorizontal: spacing(8),
  },
  status: { color: colors.textSecondary, fontSize: 13, letterSpacing: 0.6, marginBottom: spacing(3) },
  transcript: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: spacing(10),
    minHeight: 60,
  },
  orbArea: { width: ORB * 2.2, height: ORB * 2.2, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: colors.accent,
  },
  orb: { width: ORB, height: ORB, borderRadius: ORB / 2, overflow: "hidden" },
  actions: { flexDirection: "row", gap: spacing(8), marginTop: spacing(6) },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: { backgroundColor: colors.surfaceAlt },
  cancelText: { color: colors.textPrimary, fontSize: 20 },
  send: { backgroundColor: colors.accent },
  sendText: { color: "#0A1612", fontSize: 24, fontWeight: "800" },
});
