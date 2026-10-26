import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet } from "react-native";
import { AvaMark } from "./AvaLogo";
import { colors } from "../theme";

// The native splash is just a plain dark screen (no logo), so this intro owns the whole reveal:
// logo fades in first, then the wordmark and tagline, then it dissolves into the app.
const LOGO = 144;
const MIN_VISIBLE_MS = 2000;
const GLOW = require("../../assets/glow.png");
const { width: W, height: H } = Dimensions.get("window");

export function AnimatedSplash({
  ready,
  onDone,
}: {
  ready: boolean;
  onDone: () => void;
}) {
  const logo = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(Date.now());
  const exiting = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logo, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(text, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [logo, glow, text]);

  useEffect(() => {
    if (!ready || exiting.current) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    const t = setTimeout(() => {
      exiting.current = true;
      Animated.timing(exit, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(
        () => onDone()
      );
    }, wait);
    return () => clearTimeout(t);
  }, [ready, exit, onDone]);

  const textY = text.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: exit }]}>
      <Animated.View style={[styles.glow, { opacity: Animated.multiply(glow, 0.55) }]} pointerEvents="none">
        <Image source={GLOW} style={styles.glowImage} resizeMode="stretch" />
      </Animated.View>

      <Animated.View
        style={[
          styles.logo,
          { opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
        ]}
      >
        <AvaMark size={LOGO} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity: text, transform: [{ translateY: textY }] }]}>
        <Animated.Text style={styles.word}>AVA</Animated.Text>
        <Animated.Text style={styles.tagline}>Your personal agent, in your pocket.</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: H / 2 - W * 0.9, left: W * -0.1, width: W * 1.2, height: W * 1.8 },
  glowImage: { width: "100%", height: "100%", tintColor: "#38E2A4" },
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 100 },
  logo: { position: "absolute", top: "50%", left: "50%", width: LOGO, height: LOGO, marginTop: -LOGO / 2, marginLeft: -LOGO / 2 },
  textBlock: { position: "absolute", top: "50%", left: 0, right: 0, marginTop: LOGO / 2 + 26, alignItems: "center", gap: 12 },
  word: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", letterSpacing: 10, paddingLeft: 10 },
  tagline: { color: colors.textSecondary, fontSize: 14, letterSpacing: 0.4 },
});
