import { Contact, ContactField } from "expo-contacts";
import { requestPermissionsAsync } from "expo-contacts/legacy";
import { Linking, Platform } from "react-native";

async function ensureContactsPermission() {
  const { status } = await requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Contacts permission was not granted.");
  }
}

export interface ContactMatch {
  id: string;
  name: string;
  phoneNumbers: string[];
}

export async function findContact(args: { name: string }): Promise<ContactMatch[]> {
  await ensureContactsPermission();

  const results = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES], {
    name: args.name,
    limit: 10,
  });

  return results.map((c) => ({
    id: c.id,
    name: c.fullName ?? "Unknown",
    phoneNumbers: (c.phones ?? []).map((p) => p.number).filter((n): n is string => !!n),
  }));
}

function sanitizePhoneNumber(raw: string): string {
  // Strip everything except digits and a leading '+' — raw contact numbers often come
  // formatted ("+1 (555) 123-4567"), and spaces/parens break the sms: URI so the OS
  // drops the body param and just opens a blank compose screen.
  const trimmed = raw.trim();
  const sign = trimmed.startsWith("+") ? "+" : "";
  return sign + trimmed.replace(/[^\d]/g, "");
}

export async function composeTextMessage(args: { phoneNumber: string; message: string }) {
  const number = sanitizePhoneNumber(args.phoneNumber);
  // `smsto:` is the scheme Android's own SENDTO intent uses and reliably honors the
  // `body` param across messaging apps; `sms:` is the one iOS expects.
  const scheme = Platform.OS === "android" ? "smsto" : "sms";
  const url = `${scheme}:${number}?body=${encodeURIComponent(args.message)}`;

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error("No messaging app available to handle this request.");
  }
  await Linking.openURL(url);
  return { opened: true, phoneNumber: number };
}
