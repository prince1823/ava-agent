import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { queryExpenses } from "../db/db";

function toCsv(rows: ReturnType<typeof queryExpenses>): string {
  const header = "date,category,amount,note";
  const lines = rows.map((r) => {
    const note = (r.note ?? "").replace(/"/g, '""');
    return `${r.created_at},${r.category},${r.amount},"${note}"`;
  });
  return [header, ...lines].join("\n");
}

export async function exportExpensesCsv(args: { since?: string; until?: string; category?: string }) {
  const rows = queryExpenses({ since: args.since, until: args.until, category: args.category });
  if (rows.length === 0) {
    throw new Error("No expenses found for that range.");
  }

  const file = new File(Paths.cache, `expenses-${Date.now()}.csv`);
  file.create();
  await file.write(toCsv(rows));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export expenses" });
  return { exported: rows.length };
}
