import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "../src/components/Text";
import { Stack, useFocusEffect } from "expo-router";
import { colors, radius, spacing } from "../src/theme";
import { BackgroundArt } from "../src/components/BackgroundArt";
import {
  clearOutbound,
  cloudMinimised,
  ledgerSummary,
  listOutbound,
  setCloudMinimised,
  type LedgerEntry,
} from "../src/privacy/ledger";

const KIND_LABEL: Record<LedgerEntry["kind"], string> = {
  agent_turn: "Message to the model",
  tool_result: "Device result to the model",
  memory_extract: "Memory extraction",
};

const KIND_ICON: Record<LedgerEntry["kind"], string> = {
  agent_turn: "💬",
  tool_result: "🔧",
  memory_extract: "🧠",
};

const KIND_COPY: Record<LedgerEntry["kind"], string> = {
  agent_turn: "Your text, recent conversation and open promises. The device never sends tool results until you confirm the action.",
  tool_result: "The outcome of a device action Ava ran for you.",
  memory_extract: "Recent messages, used to rebuild the profile on the Memory screen.",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function PrivacyScreen() {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [minimised, setMinimised] = useState(false);
  const [summary, setSummary] = useState({ count: 0, bytes: 0, last: null as string | null });

  const refresh = useCallback(() => {
    setRows(listOutbound());
    setSummary(ledgerSummary());
    setMinimised(cloudMinimised());
  }, []);

  useFocusEffect(refresh);

  const toggle = (value: boolean) => {
    setCloudMinimised(value);
    setMinimised(value);
  };

  const clear = () => {
    Alert.alert("Clear the ledger?", "This only clears this local list. It does not change what was already sent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearOutbound();
          refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <BackgroundArt />
      <Stack.Screen options={{ title: "Privacy" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>What left your device</Text>
        <Text style={styles.heroSub}>
          Ava runs on your phone, but the reasoning model is remote. Every outbound request is recorded here, with what it
          was for and how big it was. Payloads are never stored — only metadata.
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.count}</Text>
            <Text style={styles.statLabel}>requests</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatBytes(summary.bytes)}</Text>
            <Text style={styles.statLabel}>total sent</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.last ? relative(summary.last) : "—"}</Text>
            <Text style={styles.statLabel}>last</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Cloud-minimised mode</Text>
              <Text style={styles.rowSub}>
                Skips optional cloud work — background memory extraction and follow-up suggestions. The reply you asked for
                still needs the model.
              </Text>
            </View>
            <Switch value={minimised} onValueChange={toggle} />
          </View>
        </View>

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={styles.emptyTitle}>Nothing sent yet</Text>
            <Text style={styles.emptyBody}>Send a message and it will show up here.</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {rows.map((entry, i) => (
              <View key={`${entry.at}-${i}`} style={styles.entry}>
                <Text style={styles.entryIcon}>{KIND_ICON[entry.kind]}</Text>
                <View style={styles.entryBody}>
                  <Text style={styles.entryTitle}>{KIND_LABEL[entry.kind]}</Text>
                  <Text style={styles.entryCopy}>{KIND_COPY[entry.kind]}</Text>
                  <Text style={styles.entryMeta}>
                    {new Date(entry.at).toLocaleString()} · {formatBytes(entry.bytes)} · {entry.destination.replace(/^wss?:\/\//, "")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {rows.length > 0 ? (
          <Pressable style={styles.clear} onPress={clear}>
            <Text style={styles.clearText}>Clear ledger</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footnote}>
          A fully on-device mode needs a local model, which this build does not ship yet. Until then, cloud-minimised is
          the strongest setting available.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(3) },
  hero: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
  heroSub: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  stats: { flexDirection: "row", gap: spacing(2) },
  stat: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: colors.accent, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { flex: 1, paddingRight: spacing(3) },
  rowTitle: { color: colors.textPrimary, fontSize: 13.5, fontWeight: "600" },
  rowSub: { color: colors.textSecondary, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  stack: { gap: spacing(2) },
  entry: {
    flexDirection: "row",
    gap: spacing(3),
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  entryIcon: { fontSize: 16 },
  entryBody: { flex: 1, gap: 2 },
  entryTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  entryCopy: { color: colors.textSecondary, fontSize: 11.5, lineHeight: 16 },
  entryMeta: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: spacing(8), gap: spacing(2) },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptyBody: { color: colors.textSecondary, fontSize: 12.5 },
  clear: { alignSelf: "center", paddingVertical: spacing(2) },
  clearText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  footnote: { color: colors.textFaint, fontSize: 11, textAlign: "center", lineHeight: 16 },
});