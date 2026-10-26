import * as Location from "expo-location";

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission was not granted.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const [address] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  const placeName = [address?.city, address?.region, address?.country].filter(Boolean).join(", ");

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    place: placeName || "Unknown location",
  };
}
