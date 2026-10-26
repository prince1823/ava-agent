import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, radius, spacing } from "../theme";

export function SuggestionCard({
  icon,
  label,
  title,
  index,
  onPress,
}: {
  icon: string;
  label: string;
  title: string;
  index: number;
  onPress: () => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      delay: 250 + index * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }, { scale: press }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
        onLayout={onLayout}
        style={styles.card}
      >
        {size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`fill-${index}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#8B5CF6" stopOpacity={0.22} />
                <Stop offset="0.55" stopColor="#F472B6" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#15111F" stopOpacity={0.95} />
              </LinearGradient>
              <LinearGradient id={`stroke-${index}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#C4B5FD" stopOpacity={0.9} />
                <Stop offset="0.5" stopColor="#F472B6" stopOpacity={0.4} />
                <Stop offset="1" stopColor="#818CF8" stopOpacity={0.55} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0.75}
              y={0.75}
              width={size.w - 1.5}
              height={size.h - 1.5}
              rx={radius.md}
              fill={`url(#fill-${index})`}
              stroke={`url(#stroke-${index})`}
              strokeWidth={1.5}
            />
          </Svg>
        )}

        <View style={styles.badge}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Text style={styles.arrow}>↗</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3.5),
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
    borderRadius: radius.md,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#B9A6FF1F",
    borderWidth: 1,
    borderColor: "#B9A6FF55",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 20 },
  body: { flex: 1, gap: 3 },
  label: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  arrow: { color: colors.accent, fontSize: 18, fontWeight: "700" },
});
