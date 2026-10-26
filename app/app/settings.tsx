import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View, Pressable } from "react-native";
import { Text, TextInput } from "../src/components/Text";
import { Stack, router } from "expo-router";
import { colors, radius, spacing, typography } from "../src/theme";
import { getSetting, setSetting, clearAllConversations } from "../src/db/db";
import { useAgentStore } from "../src/store/agentStore";
import { biometricsAvailable } from "../src/auth/biometrics";
import { cloudMinimised, setCloudMinimised } from "../src/privacy/ledger";

export default function SettingsScreen() {
  const [wsUrl, setWsUrl] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(true);
  const [biometricsHW, setBiometricsHW] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const newConversation = useAgentStore((s) => s.newConversation);
  const refreshConversations = useAgentStore((s) => s.refreshConversations);

  useEffect(() => {
    setWsUrl(getSetting("ws_url") ?? process.env.EXPO_PUBLIC_AGENT_WS_URL ?? "");
    setBiometricLockEnabled(getSetting("biometric_lock_enabled") !== "false");
    setMinimised(cloudMinimised());
    biometricsAvailable().then(setBiometricsHW);
  }, []);

  const saveWsUrl = () => {
    setSetting("ws_url", wsUrl.trim());
    setSavedHint(true);
    setTimeout(() => setSavedHint(false), 1500);
  };

  const toggleBiometricLock = (value: boolean) => {
    setBiometricLockEnabled(value);
    setSetting("biometric_lock_enabled", value ? "true" : "false");
  };

  const clearHistory = () => {
    Alert.alert("Clear all chat history?", "This deletes every conversation on this device. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearAllConversations();
          newConversation();
          refreshConversations();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Settings" }} />

      <Section title="Agent server">
        <Text style={styles.label}>WebSocket URL</Text>
        <TextInput
          style={styles.input}
          value={wsUrl}
          onChangeText={setWsUrl}
          placeholder="ws://192.168.1.x:8787/agent"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={saveWsUrl}>
          <Text style={styles.buttonText}>{savedHint ? "Saved — restart app to apply" : "Save"}</Text>
        </Pressable>
      </Section>

      <Section title="Security">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Biometric lock</Text>
            <Text style={styles.rowSubtitle}>
              {biometricsHW ? "Require Face/Fingerprint to open Ava" : "No biometric hardware enrolled on this device"}
            </Text>
          </View>
          <Switch
            value={biometricLockEnabled && biometricsHW}
            onValueChange={toggleBiometricLock}
            disabled={!biometricsHW}
          />
        </View>
      </Section>

      <Section title="Private mode">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Cloud-minimised mode</Text>
            <Text style={styles.rowSubtitle}>
              Skip optional cloud work (memory extraction and follow-up suggestions). Your replies still need the model.
            </Text>
          </View>
          <Switch
            value={minimised}
            onValueChange={(value) => {
              setCloudMinimised(value);
              setMinimised(value);
            }}
          />
        </View>
        <Pressable style={styles.linkRow} onPress={() => router.push("/privacy")}>
          <Text style={styles.linkText}>See what left your device</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Section>

      <Section title="Data">
        <Pressable style={styles.linkRow} onPress={() => router.push("/history")}>
          <Text style={styles.linkText}>View activity log</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.dangerButton]} onPress={clearHistory}>
          <Text style={styles.dangerButtonText}>Clear all chat history</Text>
        </Pressable>
      </Section>

      <Section title="About">
        <Text style={styles.aboutText}>Ava — a personal agent with real device tool use.</Text>
        <Text style={styles.aboutText}>Model: openai/gpt-4o-mini via OpenRouter</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  section: { marginBottom: spacing(5) },
  sectionTitle: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing(2),
    marginLeft: spacing(1),
  },
  sectionCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing(1) },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing(2),
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  dangerButton: { backgroundColor: colors.danger, marginTop: spacing(2) },
  dangerButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { flex: 1, paddingRight: spacing(3) },
  rowTitle: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  rowSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing(1) },
  linkText: { fontSize: 13, color: colors.textPrimary },
  chevron: { fontSize: 16, color: colors.textFaint },
  aboutText: { fontSize: 12, color: colors.textSecondary },
});
