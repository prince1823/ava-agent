import * as ImagePicker from "expo-image-picker";

/**
 * Picks an image from the device's library and returns it as a data URI,
 * ready to attach to a chat turn for the vision model to read (flight
 * confirmations, event posters, a screenshot with a date in it...).
 * Compressed on the way out since a raw phone screenshot can be several MB.
 */
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission was not granted.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    base64: true,
    quality: 0.5,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;

  const asset = result.assets[0];
  const mime = asset.mimeType ?? "image/jpeg";
  return `data:${mime};base64,${asset.base64}`;
}
