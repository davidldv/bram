import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "./theme";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Per-state breathing config: [min scale, max scale, half-cycle ms].
const CONFIG: Record<OrbState, [number, number, number]> = {
  idle: [1.0, 1.06, 2000],
  listening: [1.05, 1.18, 550],
  thinking: [0.98, 1.04, 900],
  speaking: [1.0, 1.12, 360],
};

export function Orb({
  state,
  onPress,
  disabled,
}: {
  state: OrbState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const [, , ms] = CONFIG[state];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: ms, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: ms, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const [min, max] = CONFIG[state];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [min, max] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel="Talk" hitSlop={24}>
      <View style={styles.wrap}>
        <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale }] }]} />
        <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
          <View style={styles.core} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const SIZE = 140;
const styles = StyleSheet.create({
  wrap: { width: SIZE * 1.6, height: SIZE * 1.6, alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    width: SIZE * 1.5,
    height: SIZE * 1.5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  orb: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accent2,
  },
  core: {
    width: SIZE * 0.5,
    height: SIZE * 0.5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent2,
    opacity: 0.7,
  },
});
