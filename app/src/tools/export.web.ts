// expo-sharing needs HTTPS and expo-file-system is only partially implemented on
// web, so export builds the CSV in memory and triggers a normal download.

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

  const csv = toCsv(rows);
  if (typeof document !== "undefined") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expenses-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return { exported: rows.length };
}