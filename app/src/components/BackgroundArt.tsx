import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");
const GLOW = require("../../assets/glow.png");

function useLoop(duration: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}

// A pre-rendered glow image (tinted per blob) instead of live SVG gradients: images are decoded once
// and composited on the GPU, so the first frame of the app paints immediately.
function Glow({
  color,
  size,
  top,
  left,
  duration,
  dx,
  dy,
  peak,
}: {
  color: string;
  size: number;
  top: number;
  left: number;
  duration: number;
  dx: number;
  dy: number;
  peak: number;
}) {
  const t = useLoop(duration);
  return (
    <Animated.View
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [peak * 0.55, peak] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-dx, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-dy, dy] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] }) },
        ],
      }}
    >
      <Image source={GLOW} style={{ width: "100%", height: "100%", tintColor: color }} resizeMode="stretch" />
    </Animated.View>
  );
}

export function BackgroundArt() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Glow color="#38E2A4" size={W * 1.3} top={-H * 0.05} left={-W * 0.15} duration={5000} dx={W * 0.25} dy={H * 0.1} peak={0.5} />
      <Glow color="#1FBF8A" size={W * 1.1} top={H * 0.4} left={W * 0.2} duration={7000} dx={W * 0.3} dy={H * 0.12} peak={0.4} />
      <Glow color="#5BF0BA" size={W * 0.9} top={H * 0.15} left={W * 0.3} duration={9000} dx={W * 0.35} dy={H * 0.18} peak={0.32} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
