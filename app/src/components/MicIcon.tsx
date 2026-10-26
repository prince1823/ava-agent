import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

export function MicIcon({ size = 20, color = "#F2FFF9" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth={1.8} />
      <Path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
