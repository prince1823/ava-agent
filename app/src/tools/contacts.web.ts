// Browsers have no contacts database, so the web surface uses fixture contacts.
// The tool contract is identical, so the agent loop and confirmation UI are unchanged.

export interface ContactMatch {
  id: string;
  name: string;
  phoneNumbers: string[];
}

const FIXTURES: ContactMatch[] = [
  { id: "c-priya", name: "Priya Sharma", phoneNumbers: ["+919876543210"] },
  { id: "c-sam", name: "Sam Fernandes", phoneNumbers: ["+919812345678"] },
  { id: "c-mom", name: "Mom", phoneNumbers: ["+919900112233"] },
  { id: "c-dan", name: "Dan Kapoor", phoneNumbers: ["+14155550123"] },
];

export async function findContact(args: { name: string }): Promise<ContactMatch[]> {
  const q = args.name.trim().toLowerCase();
  if (!q) return [];
  return FIXTURES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
}

export async function composeTextMessage(args: { phoneNumber: string; message: string }) {
  // Desktop browsers cannot open an SMS composer. Record the intent instead so the
  // confirmation/undo flow still behaves, and copy the text so it is usable.
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(args.message).catch(() => {});
  }
  return { opened: false, simulated: true, phoneNumber: args.phoneNumber, copiedMessage: true };
}