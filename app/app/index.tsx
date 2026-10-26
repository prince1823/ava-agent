import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardStickyView } from "../src/components/Keyboard";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useAgentStore } from "../src/store/agentStore";
import { MessageBubble } from "../src/components/MessageBubble";
import { Composer } from "../src/components/Composer";
import { ConfirmSheet } from "../src/components/ConfirmSheet";
import { NewChatButton } from "../src/components/NewChatButton";
import { Sidebar } from "../src/components/Sidebar";
import { BackgroundArt } from "../src/components/BackgroundArt";
import { AvaBrand } from "../src/components/AvaLogo";
import { BrainButton } from "../src/components/BrainIcon";
import { RotatingGreeting } from "../src/components/RotatingGreeting";
import { SuggestionCard } from "../src/components/SuggestionCard";
import { colors, radius, spacing } from "../src/theme";
import type { ChatMessage } from "../src/types/agent";
import { getSpendingInsight } from "../src/db/db";

const SUGGESTIONS: Array<{ icon: string; label: string; title: string; prompt: string }> = [
  { icon: "📅", label: "CALENDAR", title: "What's on my schedule today?", prompt: "What's on my calendar today?" },
  { icon: "⏰", label: "REMINDERS", title: "Remind me about dinner tomorrow at 7", prompt: "Add a dinner reminder for tomorrow at 7pm" },
  { icon: "🧠", label: "MEMORY", title: "Remember something about me", prompt: "Remember that I'm vegetarian" },
  {
    icon: "🤝",
    label: "PROMISES",
    title: "Track a promise I just made",
    prompt: "I promised Priya I'd send the invoice by Friday — keep me to it",
  },
  {
    icon: "🔮",
    label: "WHAT IF",
    title: "Simulate a plan before committing",
    prompt: "What if I skip the gym tonight and order takeaway instead?",
  },
];

export default function ChatScreen() {
  const messages = useAgentStore((s) => s.messages);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const conversationId = useAgentStore((s) => s.conversationId);
  const status = useAgentStore((s) => s.status);
  const newConversation = useAgentStore((s) => s.newConversation);
  // Don't pile up empty chats: only start a new one if this one has messages.
  const startNewChat = () => {
    if (messages.length > 0) newConversation();
  };
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastCount = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const swap = useRef(new Animated.Value(1)).current;

  // Screens like Promises and Simulator hand off a prompt through route params.
  // Wait for the socket, then send it once per distinct prompt.
  const params = useLocalSearchParams<{ prompt?: string }>();
  const handledPrompt = useRef<string | null>(null);
  useEffect(() => {
    const prompt = typeof params.prompt === "string" ? params.prompt : undefined;
    if (!prompt || handledPrompt.current === prompt || status !== "open") return;
    handledPrompt.current = prompt;
    sendMessage(prompt);
  }, [params.prompt, status, sendMessage]);

  // Crossfade + slight rise whenever the active conversation changes.
  useLayoutEffect(() => {
    swap.setValue(0);
    Animated.timing(swap, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [conversationId, swap]);

  return (
    <View style={styles.flex}>
      <BackgroundArt />

      <Stack.Screen
        options={{
          headerTitle: () => <AvaBrand status={status} />,
          headerTitleAlign: "center",
          headerLeft: () => (
            <Pressable style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>
          ),
          headerRight: () => (
            <View style={{ marginRight: spacing(3), flexDirection: "row", alignItems: "center", gap: spacing(2) }}>
              <BrainButton onPress={() => router.push("/memory")} />
              <NewChatButton onPress={startNewChat} />
            </View>
          ),
        }}
      />

      <Animated.View
        style={[
          styles.fill,
          { opacity: swap, transform: [{ translateY: swap.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
        ]}
      >
        {messages.length === 0 ? (
          <EmptyState onPick={sendMessage} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => <MessageBubble message={item} isLast={index === messages.length - 1} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => {
              // Jump instantly when a whole conversation loads; animate only for new messages.
              const jumped = Math.abs(messages.length - lastCount.current) > 2;
              lastCount.current = messages.length;
              listRef.current?.scrollToEnd({ animated: !jumped });
            }}
          />
        )}
      </Animated.View>

      <KeyboardStickyView>
        <Composer />
      </KeyboardStickyView>
      <ConfirmSheet />
      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    setInsight(getSpendingInsight());
  }, []);

  return (
    <View style={styles.empty}>
      <RotatingGreeting />

      {insight ? (
        <View style={styles.insight}>
          <Text style={styles.insightLabel}>INSIGHT</Text>
          <Text style={styles.insightText}>{insight}</Text>
        </View>
      ) : null}

      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s, i) => (
          <SuggestionCard key={s.prompt} index={i} icon={s.icon} label={s.label} title={s.title} onPress={() => onPick(s.prompt)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  list: { padding: spacing(4), paddingBottom: spacing(6) },
  empty: { flex: 1, paddingHorizontal: spacing(6), paddingTop: spacing(8), gap: spacing(4) },
  insight: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1),
  },
  insightLabel: { color: colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  insightText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  suggestions: { gap: spacing(3), marginTop: spacing(2) },
  menuButton: { paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  menuIcon: { fontSize: 18, color: colors.textPrimary },
});
