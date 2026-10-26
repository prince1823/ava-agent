// No biometric hardware in a browser: the lock screen stays off on web.

export async function biometricsAvailable(): Promise<boolean> {
  return false;
}

export async function authenticate(): Promise<boolean> {
  return true;
}