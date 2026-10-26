import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "../src/components/Keyboard";
import { initDb, getSetting } from "../src/db/db";
import { useAgentStore } from "../src/store/agentStore";
import { colors } from "../src/theme";
import { authenticate, biometricsAvailable } from "../src/auth/biometrics";
import { LockScreen } from "../src/components/LockScreen";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { AmbientBridge } from "../src/components/AmbientBridge";


export default function RootLayout() {
  const connect = useAgentStore((s) => s.connect);
  const initConversations = useAgentStore((s) => s.initConversations);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockError, setLockError] = useState<string | undefined>();
  const appState = useRef(AppState.currentState);
  const [dbReady, setDbReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    initDb();
    initConversations();
    connect();
    setDbReady(true);

    const lockEnabled = getSetting("biometric_lock_enabled") !== "false";
    if (lockEnabled) {
      biometricsAvailable().then((available) => {
        setBiometricsOn(available);
        if (available) {
          setLocked(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  useEffect(() => {
    if (!biometricsOn) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current?.match(/active/) && next.match(/inactive|background/)) {
        setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [biometricsOn]);

  // Ask for biometrics only after the intro has faded, so the prompt never sits on top of it.
  useEffect(() => {
    if (splashDone && locked && !prompted.current) {
      prompted.current = true;
      void unlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splashDone, locked]);

  const unlock = async () => {
    setLockError(undefined);
    const success = await authenticate();
    if (success) {
      setLocked(false);
    } else {
      setLockError("Authentication failed. Try again.");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardProvider>
        <StatusBar style="light" />
        {locked ? (
          <LockScreen onUnlock={unlock} error={lockError} />
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        )}
        {!splashDone && (
          <AnimatedSplash
            ready={dbReady}
            onDone={() => setSplashDone(true)}
          />
        )}
        <AmbientBridge />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
