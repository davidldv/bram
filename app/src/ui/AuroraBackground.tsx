import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from "react-native-svg";
import { colors } from "./theme";

// Full-bleed "aurora" backdrop: a deep vertical wash plus soft indigo / violet /
// cyan blobs that breathe slowly. Pure SVG gradients — no native gradient or
// blur dependency. variant="focus" pulls a brighter glow toward the centre
// (used behind the voice Orb).
export function AuroraBackground({ variant = "default" }: { variant?: "default" | "focus" }) {
  const { width, height } = useWindowDimensions();
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const focus = variant === "focus";

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="aurora-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.baseElev} />
            <Stop offset="1" stopColor={colors.base} />
          </LinearGradient>
          <RadialGradient id="aurora-indigo" cx="50%" cy={focus ? "40%" : "8%"} r="62%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={focus ? 0.5 : 0.36} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="aurora-violet" cx="10%" cy="82%" r="58%">
            <Stop offset="0" stopColor={colors.accent2} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.accent2} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="aurora-cyan" cx="92%" cy="26%" r="42%">
            <Stop offset="0" stopColor={colors.accentCyan} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.accentCyan} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#aurora-bg)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#aurora-violet)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#aurora-cyan)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#aurora-indigo)" />
      </Svg>
    </Animated.View>
  );
}
