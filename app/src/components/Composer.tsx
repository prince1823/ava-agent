import React, { useRef, useState } from "react";
import { Alert, Animated, Image, Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Text";
import * as Haptics from "expo-haptics";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors, radius, spacing } from "../theme";
import { useAgentStore } from "../store/agentStore";
import { MicIcon } from "./MicIcon";
import { ImageIcon, StopIcon } from "./Icons";
import { VoiceOverlay } from "./VoiceOverlay";
import { pickImage } from "../tools/imagePicker";
import type { AgentMode } from "../types/agent";

const MODES: Array<{ key: AgentMode; label: string; hint: string }> = [
  { key: "chat", label: "chat", hint: "Just talk to Ava" },
  { key: "plan", label: "plan", hint: "Dry-run before doing anything" },
  { key: "promise", label: "promise", hint: "Track something you said you'd do" },
];

export function Composer() {
  const [text, setText] = useState("");
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const stopGeneration = useAgentStore((s) => s.stopGeneration);
  const status = useAgentStore((s) => s.status);
  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const [listening, setListening] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
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
    if ((!trimmed && !image) || isStreaming || status !== "open") return;
    // A screenshot with no caption still needs some text for the turn — the
    // model reads the image regardless, this is just what shows in the bubble.
    sendMessage(trimmed || "Here's a screenshot — see what you can do with it.", image ? { image } : undefined);
    setText("");
    setImage(null);
  };

  const handlePickImage = async () => {
    try {
      setPickingImage(true);
      const picked = await pickImage();
      if (picked) setImage(picked);
    } catch (err) {
      Alert.alert("Couldn't open photos", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPickingImage(false);
    }
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
      sendMessage(trimmed, image ? { image } : undefined);
      setText("");
      setImage(null);
    }
  };

  return (
    <View style={styles.outer}>
      <VoiceOverlay
        visible={voiceOpen}
        level={level}
        transcript={text}
        listening={listening}
        onCancel={cancelVoice}
        onSend={sendVoice}
      />
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.modePill, mode === m.key && styles.modePillActive]}
            onPress={() => setMode(m.key)}
            accessibilityLabel={m.hint}
          >
            <Text style={[styles.modeText, mode === m.key && styles.modeTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      {image && (
        <View style={styles.previewRow}>
          <View style={styles.previewChip}>
            <Image source={{ uri: image }} style={styles.previewThumb} />
            <Text style={styles.previewLabel}>screenshot attached</Text>
            <Pressable onPress={() => setImage(null)} hitSlop={8} style={styles.previewRemove}>
              <Text style={styles.previewRemoveText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={styles.wrap}>
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
        <Pressable style={styles.iconButton} onPress={handlePickImage} disabled={pickingImage} accessibilityLabel="Attach a photo or screenshot">
          <ImageIcon size={19} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          style={[styles.iconButton, listening && !voiceOpen && styles.micActive]}
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
          style={[styles.sendButton, (!text.trim() && !image || status !== "open") && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={(!text.trim() && !image) || status !== "open"}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.bg,
  },
  modeRow: {
    flexDirection: "row",
    gap: spacing(1.5),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  modePill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  modePillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: "600",
  },
  modeTextActive: {
    color: colors.accent,
  },
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: colors.accent },
  previewRow: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing(2),
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(1.5),
    paddingRight: spacing(3),
  },
  previewThumb: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: "600",
  },
  previewRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRemoveText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
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
