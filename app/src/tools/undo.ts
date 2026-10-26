import { markActionReversed, deleteExpense, getLastAction, undoActionById, type ActionLogRow } from "../db/db";
import { deleteCalendarEvent } from "./calendar";
import { cancelReminder } from "./reminders";

async function reverse(row: ActionLogRow) {
  switch (row.type) {
    case "calendar_event":
      await deleteCalendarEvent(row.ref_id);
      break;
    case "reminder":
      await cancelReminder(row.ref_id);
      break;
    case "expense":
      deleteExpense(Number(row.ref_id));
      break;
  }
}

export async function undoLastAction() {
  const last = getLastAction();
  if (!last) {
    throw new Error("There's nothing recent to undo.");
  }
  await reverse(last);
  markActionReversed(last.id);
  return { undone: last.description };
}

export async function undoAction(id: number) {
  let description = "";
  await undoActionById(id, async (row) => {
    description = row.description;
    await reverse(row);
  });
  return { undone: description };
}
