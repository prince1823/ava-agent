import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { colors, radius, spacing, typography } from "../src/theme";
import { BackgroundArt } from "../src/components/BackgroundArt";
import {
  createCommitment,
  deleteCommitment,
  listCommitments,
  setCommitmentStatus,
  type CommitmentRow,
} from "../src/db/db";
import { scheduleReminder } from "../src/tools/reminders";
import { COMMITMENT_CATEGORY } from "../src/components/AmbientBridge";

type Tab = "open" | "done";

type DueChoice = "none" | "today" | "tomorrow" | "threeDays" | "week";

const DUE_OPTIONS: Array<{ key: DueChoice; label: string }> = [
  { key: "none", label: "No date" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "threeDays", label: "In 3 days" },
  { key: "week", label: "Next week" },
];

function dueDateFor(choice: DueChoice): string | null {
  if (choice === "none") return null;
  const d = new Date();
  if (choice === "today") d.setHours(18, 0, 0, 0);
  if (choice === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
  }
  if (choice === "threeDays") {
    d.setDate(d.getDate() + 3);
    d.setHours(18, 0, 0, 0);
  }
  if (choice === "week") {
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

function dueLabel(dueAt: string | null): { text: string; tone: "overdue" | "soon" | "later" | "none" } {
  if (!dueAt) return { text: "No date", tone: "none" };
  const due = new Date(dueAt);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  return { text: `Due in ${days}d`, tone: "later" };
}

export default function CommitmentsScreen() {
  const [tab, setTab] = useState<Tab>("open");
  const [rows, setRows] = useState<CommitmentRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [person, setPerson] = useState("");
  const [due, setDue] = useState<DueChoice>("none");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRows(listCommitments(tab));
  }, [tab]);

  useFocusEffect(refresh);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createCommitment({
      title: trimmed,
      person: person.trim() || undefined,
      dueAt: dueDateFor(due) ?? undefined,
      source: "added by hand",
    });
    setTitle("");
    setPerson("");
    setDue("none");
    setAdding(false);
    refresh();
  };

  const complete = (row: CommitmentRow) => {
    setCommitmentStatus(row.id, "done");
    refresh();
  };

  const drop = (row: CommitmentRow) => {
    Alert.alert("Drop this promise?", `"${row.title}" will be marked as dropped.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Drop",
        style: "destructive",
        onPress: () => {
          setCommitmentStatus(row.id, "dropped");
          refresh();
        },
      },
    ]);
  };

  const draftWithAva = (row: CommitmentRow) => {
    const prompt = row.person
      ? `Draft and send a message to ${row.person} about: ${row.title}. Use my contacts to find them.`
      : `Help me finish this: ${row.title}`;
    router.push({ pathname: "/", params: { prompt } });
  };

  const remindMe = async (row: CommitmentRow) => {
    setBusy(row.id);
    try {
      const fireAt = row.due_at ? new Date(row.due_at) : new Date(Date.now() + 3_600_000);
      if (row.due_at) fireAt.setHours(9, 0, 0, 0);
      await scheduleReminder({
        title: `Follow up: ${row.title}`,
        body: row.person ? `You promised ${row.person}.` : "You said you'd do this.",
        fireAt: fireAt.toISOString(),
        data: { route: "/commitments", commitmentId: row.id },
        categoryIdentifier: COMMITMENT_CATEGORY,
      });
      Alert.alert("Reminder set", "Ava will nudge you before it's due.");
    } catch (err) {
      Alert.alert("Couldn't set a reminder", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundArt />
      <Stack.Screen options={{ title: "Promises" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hero}>Promises Ava is holding you to</Text>
        <Text style={styles.heroSub}>
          Things you said you’d do — to yourself or to someone else. Tap one to finish it, remind yourself, or have Ava
          draft the message.
        </Text>

        <View style={styles.segment}>
          {(["open", "done"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.segmentItem, tab === t && styles.segmentActive]}
              onPress={() => {
                setTab(t);
                setRows(listCommitments(t));
              }}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t === "open" ? "Open" : "Completed"}
              </Text>
            </Pressable>
          ))}
        </View>

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyTitle}>{tab === "open" ? "Nothing outstanding" : "Nothing completed yet"}</Text>
            <Text style={styles.emptyBody}>
              Say things like “I promised Priya I’d send the invoice by Friday” and Ava will track it here.
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {rows.map((row) => {
              const dueInfo = dueLabel(row.due_at);
              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{row.title}</Text>
                    {row.status === "open" ? (
                      <View style={[styles.dueChip, dueChipStyle(dueInfo.tone)]}>
                        <Text style={[styles.dueText, dueTextStyle(dueInfo.tone)]}>{dueInfo.text}</Text>
                      </View>
                    ) : (
                      <View style={styles.dueChip}>
                        <Text style={styles.dueText}>Done</Text>
                      </View>
                    )}
                  </View>

                  {row.person ? <Text style={styles.person}>with {row.person}</Text> : null}
                  {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}

                  {row.status === "open" ? (
                    <View style={styles.actions}>
                      <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => complete(row)}>
                        <Text style={styles.actionPrimaryText}>Done</Text>
                      </Pressable>
                      <Pressable style={styles.action} onPress={() => remindMe(row)} disabled={busy === row.id}>
                        <Text style={styles.actionText}>{busy === row.id ? "…" : "Remind me"}</Text>
                      </Pressable>
                      <Pressable style={styles.action} onPress={() => draftWithAva(row)}>
                        <Text style={styles.actionText}>Draft</Text>
                      </Pressable>
                      <Pressable style={styles.action} onPress={() => drop(row)}>
                        <Text style={styles.actionMuted}>Drop</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.actions}>
                      <Pressable
                        style={styles.action}
                        onPress={() => {
                          setCommitmentStatus(row.id, "open");
                          refresh();
                        }}
                      >
                        <Text style={styles.actionText}>Reopen</Text>
                      </Pressable>
                      <Pressable
                        style={styles.action}
                        onPress={() => {
                          deleteCommitment(row.id);
                          refresh();
                        }}
                      >
                        <Text style={styles.actionMuted}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
          <Text style={styles.addButtonText}>+ Add a promise</Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={adding} animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAdding(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New promise</Text>
            <TextInput
              style={styles.input}
              placeholder="What did you promise?"
              placeholderTextColor={colors.textFaint}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="To whom? (optional)"
              placeholderTextColor={colors.textFaint}
              value={person}
              onChangeText={setPerson}
            />
            <View style={styles.dueRow}>
              {DUE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.dueOption, due === opt.key && styles.dueOptionActive]}
                  onPress={() => setDue(opt.key)}
                >
                  <Text style={[styles.dueOptionText, due === opt.key && styles.dueOptionTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <Pressable style={[styles.sheetButton, styles.sheetCancel]} onPress={() => setAdding(false)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.sheetButton, styles.sheetSave]} onPress={submit}>
                <Text style={styles.sheetSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function dueChipStyle(tone: "overdue" | "soon" | "later" | "none") {
  if (tone === "overdue") return { backgroundColor: colors.danger + "22", borderColor: colors.danger + "55" };
  if (tone === "soon") return { backgroundColor: colors.warning + "22", borderColor: colors.warning + "55" };
  return { backgroundColor: colors.surfaceAlt, borderColor: colors.border };
}

function dueTextStyle(tone: "overdue" | "soon" | "later" | "none") {
  if (tone === "overdue") return { color: colors.danger };
  if (tone === "soon") return { color: colors.warning };
  return { color: colors.textSecondary };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(4), paddingBottom: spacing(12), gap: spacing(3) },
  hero: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
  heroSub: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, paddingVertical: spacing(2), alignItems: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  segmentTextActive: { color: colors.accent },
  stack: { gap: spacing(2.5) },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(1.5),
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing(2) },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  dueChip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing(2), paddingVertical: 3 },
  dueText: { fontSize: 10.5, fontWeight: "700" },
  person: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  detail: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2), marginTop: spacing(2) },
  action: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionPrimaryText: { color: "#0A1612", fontWeight: "700", fontSize: 12 },
  actionText: { color: colors.textPrimary, fontWeight: "600", fontSize: 12 },
  actionMuted: { color: colors.textFaint, fontWeight: "600", fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: spacing(10), gap: spacing(2) },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  addButton: {
    marginTop: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: spacing(3.5),
    alignItems: "center",
  },
  addButtonText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(5),
    paddingBottom: spacing(10),
    gap: spacing(3),
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    fontSize: 14,
    color: colors.textPrimary,
  },
  dueRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  dueOption: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  dueOptionActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  dueOptionText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  dueOptionTextActive: { color: colors.accent },
  sheetActions: { flexDirection: "row", gap: spacing(3), marginTop: spacing(1) },
  sheetButton: { flex: 1, paddingVertical: spacing(3.5), borderRadius: radius.md, alignItems: "center" },
  sheetCancel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  sheetCancelText: { color: colors.textSecondary, fontWeight: "700" },
  sheetSave: { backgroundColor: colors.accent },
  sheetSaveText: { color: "#FFFFFF", fontWeight: "700" },
  caption: typography.caption,
});