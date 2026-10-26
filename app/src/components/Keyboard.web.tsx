import React from "react";
import { View, type ViewProps } from "react-native";

// Web stand-ins for react-native-keyboard-controller, which ships no web build.
// The keyboard is handled by the browser; the sticky view just becomes a plain View.

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function KeyboardStickyView({ children, ...rest }: ViewProps & { children?: React.ReactNode }) {
  return <View {...rest}>{children}</View>;
}