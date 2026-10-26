import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { colors, radius, spacing } from "../src/theme";
import { BackgroundArt } from "../src/components/BackgroundArt";
import { useAgentStore } from "../src/store/agentStore";
import type { SimulatedAction, SimulationResult } from "../src/tools/simulate";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:00`;
}

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return localIso(d);
}

interface Preset {
  id: string;
  icon: string;
  label: string;
  blurb: string;
  horizon: "day" | "week";
  actions: SimulatedAction[];
}

const PRESETS: Preset[] = [
  {
    id: "lunch",
    icon: "🍜",
    label: "Lunch out today",
    blurb: "One meal out, no calendar change",
    horizon: "day",
    actions: [
      {
        tool: "add_expense",
        summary: "Lunch out",
        at: at(0, 13),
        args: { amount: 22, category: "food", note: "Lunch out" },
      },
    ],
  },
  {
    id: "dentist",
    icon: "🦷",
    label: "Dentist tomorrow 3pm",
    blurb: "Event plus a reminder 30 minutes before",
    horizon: "day",
    actions: [
      {
        tool: "create_calendar_event",
        summary: "Dentist appointment",
        at: at(1, 15),
        args: { title: "Dentist", start: at(1, 15), end: at(1, 15, 45), location: "City Dental" },
      },
      {
        tool: "schedule_reminder",
        summary: "Leave for the dentist",
        at: at(1, 14, 30),
        args: { title: "Dentist", body: "Leave in 30 minutes", fireAt: at(1, 14, 30) },
      },
    ],
  },
  {
    id: "clash",
    icon: "⚠️",
    label: "Dinner tomorrow 7pm",
    blurb: "Shows a real conflict with your calendar",
    horizon: "day",
    actions: [
      {
        tool: "create_calendar_event",
        summary: "Dinner with Priya",
        at: at(1, 19),
        args: { title: "Dinner with Priya", start: at(1, 19), end: at(1, 21) },
      },
    ],
  },
  {
    id: "takeaway",
    icon: "🥡",
    label: "Takeaway all week",
    blurb: "Five meals out over the next week",
    horizon: "week",
    actions: [0, 1, 2, 3, 4].map((i) => ({
      tool: "add_expense" as const,
      summary: "Takeaway dinner",
      at: at(i, 20),
      args: { amount: 15, category: "food", note: "Takeaway" },
    })),
  },
  {
    id: "text",
    icon: "💬",
    label: "Nudge Priya about dinner",
    blurb: "Flags something that cannot be undone",
    horizon: "day",
    actions: [
      {
        tool: "send_text_message",
        summary: "Text Priya about dinner",
        at: at(0, 17),
        args: { phoneNumber: "+919876543210", message: "Still on for dinner tomorrow?" },
      },
    ],
  },
];

export default function SimulatorScreen() {
  const lastSimulation = useAgentStore((s) => s.lastSimulation);
  const runSimulation = useAgentStore((s) => s.runSimulation);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const run = async (preset: Preset) => {
    setRunning(preset.id);
    setError(null);
    setActiveId(preset.id);
    try {
      await runSimulation({ actions: preset.actions, horizon: preset.horizon });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setRunning(null);
    }
  };

  const simulation: SimulationResult | null = lastSimulation;

  return (
    <View style={styles.root}>
      <BackgroundArt />
      <Stack.Screen options={{ title: "Simulator" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>Try it before you do it</Text>
        <Text style={styles.heroSub}>
          Every card dry-runs a plan against your real calendar, spending and reminders — then shows what would change.
          Nothing is written.
        </Text>

        <View style={styles.presets}>
          {PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={[styles.preset, activeId === preset.id && styles.presetActive]}
              onPress={() => run(preset)}
              disabled={!!running}
            >
              <Text style={styles.presetIcon}>{preset.icon}</Text>
              <View style={styles.presetBody}>
                <Text style={styles.presetLabel}>{preset.label}</Text>
                <Text style={styles.presetBlurb}>{preset.blurb}</Text>
              </View>
              {running === preset.id ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.presetGo}>›</Text>}
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!simulation ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔮</Text>
            <Text style={styles.emptyTitle}>No simulation yet</Text>
            <Text style={styles.emptyBody}>
              Pick a scenario above, or just ask Ava “what if I take a cab instead of the bus?” in chat — it calls the
              same dry-run engine and lands here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.simHead}>
              <Text style={styles.simTitle}>
                {simulation.horizon === "week" ? "Next 7 days" : "Next 24 hours"}
              </Text>
              <View style={styles.simBadge}>
                <Text style={styles.simBadgeText}>DRY RUN</Text>
              </View>
            </View>

            <View style={styles.impacts}>
              {simulation.impacts.map((impact) => (
                <View key={impact.label} style={styles.impact}>
                  <Text style={styles.impactLabel}>{impact.label}</Text>
                  <Text style={styles.impactValues}>
                    {impact.before} <Text style={styles.impactArrow}>→</Text> {impact.after}
                  </Text>
                  <View style={[styles.delta, deltaStyle(impact.tone)]}>
                    <Text style={[styles.deltaText, deltaTextStyle(impact.tone)]}>{impact.delta}</Text>
                  </View>
                </View>
              ))}
            </View>

            {simulation.conflicts.length > 0 ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertTitle}>Conflicts</Text>
                {simulation.conflicts.map((c) => (
                  <Text key={c} style={styles.alertText}>
                    {c}
                  </Text>
                ))}
              </View>
            ) : null}

            {simulation.irreversible.length > 0 ? (
              <View style={[styles.alertBox, styles.alertDanger]}>
                <Text style={styles.alertTitle}>Cannot be undone</Text>
                {simulation.irreversible.map((c) => (
                  <Text key={c} style={styles.alertText}>
                    {c}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>Timeline</Text>
              {simulation.timeline.map((entry, i) => (
                <View key={`${entry.at}-${i}`} style={styles.row}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, dotStyle(entry.kind)]} />
                    {i < simulation.timeline.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTime}>{new Date(entry.at).toLocaleString()}</Text>
                    <Text style={styles.rowTitle}>{entry.title}</Text>
                    {entry.detail ? <Text style={styles.rowDetail}>{entry.detail}</Text> : null}
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.summary}>{simulation.summary}</Text>

            <Pressable
              style={styles.cta}
              onPress={() =>
                router.push({
                  pathname: "/",
                  params: {
                    prompt:
                      "Run the plan I just simulated for real, confirming each real-world action as you go.",
                  },
                })
              }
            >
              <Text style={styles.ctaText}>Ask Ava to do it for real</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function deltaStyle(tone: "up" | "down" | "flat") {
  if (tone === "up") return { backgroundColor: colors.warning + "22", borderColor: colors.warning + "55" };
  if (tone === "down") return { backgroundColor: colors.success + "22", borderColor: colors.success + "55" };
  return { backgroundColor: colors.surfaceAlt, borderColor: colors.border };
}

function deltaTextStyle(tone: "up" | "down" | "flat") {
  if (tone === "up") return { color: colors.warning };
  if (tone === "down") return { color: colors.success };
  return { color: colors.textSecondary };
}

function dotStyle(kind: string) {
  switch (kind) {
    case "event":
      return { backgroundColor: colors.accent };
    case "reminder":
      return { backgroundColor: colors.warning };
    case "expense":
      return { backgroundColor: "#F5C56B" };
    case "message":
      return { backgroundColor: colors.danger };
    default:
      return { backgroundColor: colors.textFaint };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(3) },
  hero: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
  heroSub: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  presets: { gap: spacing(2) },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  presetActive: { borderColor: colors.accent + "88" },
  presetIcon: { fontSize: 18 },
  presetBody: { flex: 1 },
  presetLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  presetBlurb: { color: colors.textSecondary, fontSize: 11.5, marginTop: 2 },
  presetGo: { color: colors.textFaint, fontSize: 20 },
  error: { color: colors.danger, fontSize: 12.5 },
  empty: { alignItems: "center", paddingVertical: spacing(8), gap: spacing(2) },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  simHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  simTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  simBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent + "66",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing(2.5),
    paddingVertical: 3,
  },
  simBadgeText: { color: colors.accent, fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  impacts: { flexDirection: "row", gap: spacing(2) },
  impact: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(1),
  },
  impactLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  impactValues: { color: colors.textPrimary, fontSize: 12.5, fontWeight: "600" },
  impactArrow: { color: colors.textFaint },
  delta: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    marginTop: 2,
  },
  deltaText: { fontSize: 10.5, fontWeight: "700" },
  alertBox: {
    backgroundColor: colors.warning + "18",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning + "55",
    padding: spacing(3),
    gap: 2,
  },
  alertDanger: { backgroundColor: colors.danger + "18", borderColor: colors.danger + "55" },
  alertTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  alertText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  timelineCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(1),
  },
  timelineTitle: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: spacing(2),
  },
  row: { flexDirection: "row", gap: spacing(3) },
  rail: { alignItems: "center", width: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  line: { flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 2 },
  rowBody: { flex: 1, paddingBottom: spacing(3) },
  rowTime: { color: colors.textFaint, fontSize: 10.5, fontWeight: "600" },
  rowTitle: { color: colors.textPrimary, fontSize: 13.5, fontWeight: "600", marginTop: 1 },
  rowDetail: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  summary: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontStyle: "italic" },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: "center",
  },
  ctaText: { color: "#0A1612", fontWeight: "800", fontSize: 13.5 },
});