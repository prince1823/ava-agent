import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { colors, radius, spacing } from "../src/theme";
import { listActionLog, type ActionLogRow, type UndoableActionType } from "../src/db/db";
import { undoAction } from "../src/tools/undo";

const TYPE_ICON: Record<UndoableActionType, string> = {
  calendar_event: "📅",
  reminder: "⏰",
  expense: "💵",
};

export default function HistoryScreen() {
  const [rows, setRows] = useState<ActionLogRow[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => setRows(listActionLog()), []);
  useFocusEffect(refresh);

  const handleUndo = async (row: ActionLogRow) => {
    setBusyId(row.id);
    try {
      await undoAction(row.id);
      refresh();
    } catch (err) {
      Alert.alert("Couldn't undo", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: "Activity" }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No real-world actions yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.icon}>{TYPE_ICON[item.type]}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {item.reversed ? (
              <Text style={styles.reversedBadge}>Undone</Text>
            ) : (
              <Pressable style={styles.undoButton} onPress={() => handleUndo(item)} disabled={busyId === item.id}>
                <Text style={styles.undoText}>{busyId === item.id ? "…" : "Undo"}</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing(4) },
  empty: { color: colors.textFaint, fontSize: 13, textAlign: "center", marginTop: spacing(10) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    marginBottom: spacing(2),
    gap: spacing(2.5),
  },
  icon: { fontSize: 18 },
  rowBody: { flex: 1 },
  description: { fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  time: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  undoButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  undoText: { fontSize: 11, color: colors.textPrimary, fontWeight: "600" },
  reversedBadge: { fontSize: 11, color: colors.textFaint, fontStyle: "italic" },
});
