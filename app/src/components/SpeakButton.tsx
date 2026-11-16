import React, { useEffect, useState } from "react";
import * as Speech from "expo-speech";
import { colors } from "../theme";
import { MuteIcon, SpeakerIcon } from "./Icons";

// Device TTS engines rarely label voices with gender in a usable field, so we
// best-effort match common male voice names (works well on iOS — "Daniel",
// "Aaron", "Fred" — and on engines that do label Android voices), and always
// drop the pitch a bit as a reliable fallback that reads male on any voice.
let maleVoiceId: string | null | undefined; // undefined = not looked up yet

async function findMaleVoiceId(): Promise<string | null> {
  if (maleVoiceId !== undefined) return maleVoiceId;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => v.language?.toLowerCase().startsWith("en"));
    const male = english.find((v) => /male|daniel|aaron|fred|alex|tom\b/i.test(v.name ?? v.identifier ?? ""));
    maleVoiceId = male?.identifier ?? null;
  } catch {
    maleVoiceId = null;
  }
  return maleVoiceId;
}

/**
 * Read an assistant reply aloud. expo-speech covers iOS, Android and web.
 * A message can only speak one at a time: starting a new one stops the previous.
 */
export function useSpeech(text: string) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, [text]);

  const toggle = async () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const voice = await findMaleVoiceId();
    Speech.speak(text, {
      pitch: 0.82,
      rate: 0.98,
      voice: voice ?? undefined,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return { speaking, toggle };
}

export function SpeakGlyph({ speaking }: { speaking: boolean }) {
  return speaking ? <MuteIcon color={colors.accent} /> : <SpeakerIcon />;
}