import * as LocalAuthentication from "expo-local-authentication";

export async function biometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Ava",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
