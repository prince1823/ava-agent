// Drop-in replacements for RN's Text/TextInput that always carry the app's
// font family. React's `defaultProps` only fills in a prop that's entirely
// omitted, so it can't apply a default `style.fontFamily` to components that
// already pass their own `style` (nearly all of them here) — a real wrapper
// is the only reliable way to set a font app-wide without rewriting every
// StyleSheet.
import React from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { FONT_WEIGHTS } from "../theme/font";

function pickFamily(style: TextProps["style"]): string {
  const flat = Array.isArray(style) ? style : [style];
  for (let i = flat.length - 1; i >= 0; i--) {
    const s = flat[i] as { fontWeight?: string | number; fontFamily?: string } | null | undefined;
    if (s?.fontFamily) return s.fontFamily;
    if (s?.fontWeight !== undefined) {
      const w = String(s.fontWeight);
      if (w === "bold" || Number(w) >= 700) return FONT_WEIGHTS.bold;
      if (Number(w) >= 600) return FONT_WEIGHTS.semibold;
      if (Number(w) >= 500) return FONT_WEIGHTS.medium;
    }
  }
  return FONT_WEIGHTS.regular;
}

interface AppTextProps extends TextProps {
  /**
   * UI chrome (labels, headers, buttons) renders lowercase by default — the
   * Cred-style look the app is going for. Real content — chat messages,
   * markdown, anything the user or the model actually wrote — must opt out
   * with this, since lowercasing a reply would mangle code, URLs and names.
   */
  preserveCase?: boolean;
}

export function Text({ style, preserveCase, ...props }: AppTextProps) {
  return (
    <RNText
      style={[{ fontFamily: pickFamily(style) }, !preserveCase && styles.lowercase, style]}
      {...props}
    />
  );
}

const styles = { lowercase: { textTransform: "lowercase" as const } };

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput style={[{ fontFamily: pickFamily(style) }, style]} {...props} />;
}
