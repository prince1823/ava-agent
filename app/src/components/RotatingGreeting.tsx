import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil?";
  if (h < 12) return "Good morning. Let's make it count.";
  if (h < 17) return "Good afternoon. What's next?";
  if (h < 21) return "Good evening. Let's wrap things up.";
  return "Winding down? I've got you.";
}

const LINES: Array<{ title: string; sub: string }> = [
  { title: timeGreeting(), sub: "Tell me what you need, I'll handle it." },
  { title: "Your day, handled.", sub: "Calendar, reminders, spending, all in one chat." },
  { title: "Ask me anything.", sub: "I can act on your phone, not just talk." },
  { title: "Got a plan? Let's lock it in.", sub: "I'll check conflicts before I book anything." },
  { title: "Forget the busywork.", sub: "Say it once and I'll remember it for you." },
  { title: "Ready when you are.", sub: "Hold the mic to talk instead of type." },
];

const HOLD_MS = 3600;

export function RotatingGreeting() {
  const [index, setIndex] = useState(0);
  const p = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      Animated.timing(p, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished || cancelled) return;
          setIndex((i) => (i + 1) % LINES.length);
          Animated.timing(p, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        }
      );
    }, HOLD_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [p]);

  const line = LINES[index];
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity: p, transform: [{ translateY }] }}>
        <Text style={styles.title}>{line.title}</Text>
        <Text style={styles.sub}>{line.sub}</Text>
      </Animated.View>
      <View style={styles.dots}>
        {LINES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 150, justifyContent: "flex-start" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: colors.textPrimary },
  sub: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: spacing(2) },
  dots: { flexDirection: "row", gap: 6, marginTop: spacing(4) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.accent },
});
