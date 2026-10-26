import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { size?: number; color?: string };

export function CopyIcon({ size = 16, color = "#8FB3A6" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="9" width="11" height="11" rx="2.5" stroke={color} strokeWidth={1.8} />
      <Path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color = "#B9A6FF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RefreshIcon({ size = 16, color = "#8FB3A6" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 11a8 8 0 1 0-2.3 5.7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M20 4v7h-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StopIcon({ size = 16, color = "#0A1612" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6" y="6" width="12" height="12" rx="2.5" fill={color} />
    </Svg>
  );
}

export function SpeakerIcon({ size = 16, color = "#8FB3A6" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M15.5 9.2a4 4 0 0 1 0 5.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ImageIcon({ size = 16, color = "#8FB3A6" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke={color} strokeWidth={1.8} />
      <Circle cx="8.3" cy="9.3" r="1.6" stroke={color} strokeWidth={1.8} />
      <Path d="M4 16.5l5-5 3.2 3.2L15.5 11l4.5 5.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MuteIcon({ size = 16, color = "#B9A6FF" }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M16 10l4 4M20 10l-4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
