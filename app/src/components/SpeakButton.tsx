import React, { useEffect, useState } from "react";
import * as Speech from "expo-speech";
import { colors } from "../theme";
import { MuteIcon, SpeakerIcon } from "./Icons";

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

  const toggle = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(text, {
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