import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors, radius, spacing } from "../theme";
import { useAgentStore } from "../store/agentStore";
import { MicIcon } from "./MicIcon";
import { StopIcon } from "./Icons";
import { VoiceOverlay } from "./VoiceOverlay";

export function Composer() {
  const [text, setText] = useState("");
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const stopGeneration = useAgentStore((s) => s.stopGeneration);
  const status = useAgentStore((s) => s.status);
  const [listening, setListening] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const level = useRef(new Animated.Value(0)).current;

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));
  useSpeechRecognitionEvent("volumechange", (event) => {
    const normalized = Math.min(1, Math.max(0, (event.value + 2) / 12));
    Animated.timing(level, { toValue: normalized, duration: 90, useNativeDriver: true }).start();
  });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setText(transcript);
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || status !== "open") return;
    sendMessage(trimmed);
    setText("");
  };

  const handleMic = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    setText("");
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true });
  };

  const startVoice = async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    level.setValue(0);
    setVoiceOpen(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  };

  const cancelVoice = () => {
    ExpoSpeechRecognitionModule.abort();
    setText("");
    setVoiceOpen(false);
  };

  const sendVoice = () => {
    ExpoSpeechRecognitionModule.stop();
    setVoiceOpen(false);
    const trimmed = text.trim();
    if (trimmed && status === "open" && !isStreaming) {
      sendMessage(trimmed);
      setText("");
    }
  };

  return (
    <View style={styles.wrap}>
      <VoiceOverlay
        visible={voiceOpen}
        level={level}
        transcript={text}
        listening={listening}
        onCancel={cancelVoice}
        onSend={sendVoice}
      />
      <View style={styles.pill}>
        <TextInput
          style={styles.input}
          placeholder={listening ? "Listening…" : "What is on your mind?"}
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[styles.micButton, listening && !voiceOpen && styles.micActive]}
          onPress={handleMic}
          onLongPress={startVoice}
          delayLongPress={350}
        >
          <MicIcon size={20} color={listening && !voiceOpen ? "#0A1612" : colors.textPrimary} />
        </Pressable>
      </View>
      {isStreaming ? (
        <Pressable style={styles.sendButton} onPress={stopGeneration} accessibilityLabel="Stop">
          <StopIcon size={18} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    backgroundColor: colors.bg,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing(3),
    maxHeight: 120,
    fontSize: 14,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: colors.accent },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: colors.surfaceAlt },
  sendText: { color: "#0A1612", fontSize: 20, fontWeight: "800" },
});
