import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "../theme";
import type { ChatMessage } from "../types/agent";
import { useAgentStore } from "../store/agentStore";
import { AvaMark } from "./AvaLogo";
import { CheckIcon, CopyIcon, RefreshIcon } from "./Icons";
import { SpeakGlyph, useSpeech } from "./SpeakButton";
import { Markdown } from "./Markdown";
import { TypingDots } from "./TypingDots";

function ActionButton({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={styles.action}>
      {children}
    </Pressable>
  );
}

function Chips({ items }: { items: string[] }) {
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [items, enter]);
  return (
    <Animated.View
      style={[styles.chips, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      {items.map((s) => (
        <Pressable
          key={s}
          style={styles.chip}
          onPress={() => {
            Keyboard.dismiss();
            sendMessage(s);
          }}
        >
          <Text style={styles.chipText}>{s}</Text>
          <Text style={styles.chipArrow}>↗</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

function AssistantMessage({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const regenerateLast = useAgentStore((s) => s.regenerateLast);
  const suggestions = useAgentStore((s) => s.suggestions);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const [copied, setCopied] = useState(false);
  const { speaking, toggle: toggleSpeech } = useSpeech(message.text);

  const waiting = !!message.streaming && !message.text;
  const done = !message.streaming && !!message.text;

  const copy = async () => {
    await Clipboard.setStringAsync(message.text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={styles.assistantRow}>
      <View style={styles.avatar}>
        <AvaMark size={22} />
      </View>
      <View style={styles.assistantBody}>
        {waiting ? (
          <View style={styles.typing}>
            <TypingDots />
          </View>
        ) : (
          <Markdown>{message.text}</Markdown>
        )}

        {done && (
          <View style={styles.actions}>
            <ActionButton onPress={copy} label="Copy">
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            </ActionButton>
            <ActionButton onPress={toggleSpeech} label={speaking ? "Stop reading" : "Read aloud"}>
              <SpeakGlyph speaking={speaking} />
            </ActionButton>
            {isLast && !isStreaming && (
              <ActionButton onPress={regenerateLast} label="Regenerate">
                <RefreshIcon size={16} />
              </ActionButton>
            )}
          </View>
        )}

        {isLast && done && !isStreaming && suggestions.length > 0 && <Chips items={suggestions} />}
      </View>
    </View>
  );
}

export function MessageBubble({ message, isLast = false }: { message: ChatMessage; isLast?: boolean }) {
  if (message.role === "user") {
    return (
      <View style={styles.userWrap}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }
  return <AssistantMessage message={message} isLast={isLast} />;
}

const styles = StyleSheet.create({
  userWrap: { alignSelf: "flex-end", maxWidth: "86%", marginVertical: spacing(2) },
  userBubble: {
    backgroundColor: colors.bubbleUser,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  userText: { color: "#0A1612", fontSize: 15, lineHeight: 21, fontWeight: "600" },
  assistantRow: { flexDirection: "row", gap: spacing(3), marginVertical: spacing(2.5), alignSelf: "stretch" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  assistantBody: { flex: 1, minWidth: 0 },
  typing: { paddingTop: 10 },
  actions: { flexDirection: "row", gap: spacing(1), marginTop: spacing(1), marginLeft: -6 },
  action: { padding: 7, borderRadius: radius.pill },
  chips: { gap: spacing(2), marginTop: spacing(3), alignItems: "flex-start" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    backgroundColor: "#38E2A414",
    borderWidth: 1,
    borderColor: "#38E2A455",
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: spacing(3.5),
  },
  chipText: { color: colors.textPrimary, fontSize: 13.5, fontWeight: "500" },
  chipArrow: { color: colors.accent, fontSize: 13, fontWeight: "700" },
});
