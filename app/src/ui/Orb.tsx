import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "./theme";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const SIZE = 132;
const WRAP = Math.round(SIZE * 1.6);
const R = SIZE / 2;

// Half-cycle of the ping-pong pulse per state, ms.
const PULSE_MS: Record<OrbState, number> = {
  idle: 2600,
  listening: 900,
  thinking: 1000,
  speaking: 420,
};

// A flat mic dial. State is expressed by ring motion, not glow: idle breathes
// the center dot, listening ticks a ring outward, thinking rotates a dashed
// arc, speaking pulses the disc on a quick rhythm. All motion native-driven.
export function Orb({
  state,
  onPress,
  disabled,
}: {
  state: OrbState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current; // ping-pong 0↔1
  const sweep = useRef(new Animated.Value(0)).current; // sawtooth 0→1

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS[state],
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_MS[state],
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  useEffect(() => {
    sweep.setValue(0);
    const listening = state === "listening";
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: listening ? 900 : 1400,
        easing: listening ? Easing.out(Easing.quad) : Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [state, sweep]);

  const discScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: state === "speaking" ? [1, 1.05] : [1, 1],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      state === "idle" ? [0.3, 1] : state === "thinking" ? [0.35, 0.35] : [1, 1],
  });
  const tickScale = sweep.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const tickOpacity = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel="Talk" hitSlop={24}>
      <View style={styles.wrap}>
        {/* Listening: a thin ring ticks outward and fades */}
        {state === "listening" && (
          <Animated.View
            style={[styles.layer, { opacity: tickOpacity, transform: [{ scale: tickScale }] }]}
            pointerEvents="none"
          >
            <Svg width={WRAP} height={WRAP}>
              <Circle
                cx={WRAP / 2}
                cy={WRAP / 2}
                r={R}
                stroke="#FFFFFF"
                strokeOpacity={0.8}
                strokeWidth={1}
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}

        {/* The dial: flat disc, hairline rim, static concentric rings */}
        <Animated.View style={{ transform: [{ scale: discScale }] }}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={R}
              cy={R}
              r={R - 1}
              fill={colors.surface}
              stroke={colors.hairlineStrong}
              strokeWidth={1}
            />
            <Circle cx={R} cy={R} r={R * 0.72} stroke="rgba(255,255,255,0.10)" strokeWidth={1} fill="none" />
            <Circle cx={R} cy={R} r={R * 0.48} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
          </Svg>

          {/* Thinking: a dashed arc rotates */}
          {state === "thinking" && (
            <Animated.View
              style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
              pointerEvents="none"
            >
              <Svg width={SIZE} height={SIZE}>
                <Circle
                  cx={R}
                  cy={R}
                  r={R * 0.6}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1.5}
                  strokeDasharray="4 10"
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
          )}

          {/* Center dot — the only color on the dial */}
          <View style={styles.dotWrap} pointerEvents="none">
            <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WRAP, height: WRAP, alignItems: "center", justifyContent: "center" },
  layer: {
    position: "absolute",
    width: WRAP,
    height: WRAP,
    alignItems: "center",
    justifyContent: "center",
  },
  dotWrap: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
