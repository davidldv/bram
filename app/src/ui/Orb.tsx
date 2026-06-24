import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { colors } from "./theme";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Per-state breathing config: [min scale, max scale, half-cycle ms].
const CONFIG: Record<OrbState, [number, number, number]> = {
  idle: [1.0, 1.05, 2200],
  listening: [1.04, 1.16, 560],
  thinking: [0.99, 1.05, 1000],
  speaking: [1.0, 1.12, 380],
};

const SIZE = 156;
const GLOW = SIZE * 1.95;

// The signature element: a glowing brand-gradient sphere. A soft radial halo
// breathes with the conversation state; a specular sheen orbits slowly for a
// living, three-dimensional feel. All motion is native-driven (View transforms);
// the gradients are static SVG.
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
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const [, , ms] = CONFIG[state];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: ms,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: ms,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  useEffect(() => {
    const duration = state === "idle" ? 16000 : 6000;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [state, spin]);

  const [min, max] = CONFIG[state];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [min, max] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel="Talk" hitSlop={24}>
      <View style={styles.wrap}>
        {/* Soft breathing halo */}
        <Animated.View
          style={[styles.layer, { opacity: haloOpacity, transform: [{ scale }] }]}
          pointerEvents="none"
        >
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id="orb-halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.accent} stopOpacity="0.55" />
                <Stop offset="0.55" stopColor={colors.accent2} stopOpacity="0.22" />
                <Stop offset="1" stopColor={colors.accent2} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#orb-halo)" />
          </Svg>
        </Animated.View>

        {/* Gradient sphere */}
        <Animated.View style={[styles.sphere, { transform: [{ scale }] }]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="orb-fill" cx="34%" cy="28%" r="80%">
                <Stop offset="0" stopColor={colors.accentCyan} />
                <Stop offset="0.45" stopColor={colors.accent} />
                <Stop offset="1" stopColor={colors.accent2} />
              </RadialGradient>
              <RadialGradient id="orb-shade" cx="50%" cy="50%" r="50%">
                <Stop offset="0.6" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#05060C" stopOpacity="0.4" />
              </RadialGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 1} fill="url(#orb-fill)" />
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 1} fill="url(#orb-shade)" />
          </Svg>
          {/* Orbiting specular sheen */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.sheenWrap, { transform: [{ rotate }] }]}
            pointerEvents="none"
          >
            <View style={styles.sheen} />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: GLOW, height: GLOW, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", width: GLOW, height: GLOW, alignItems: "center", justifyContent: "center" },
  sphere: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sheenWrap: { alignItems: "center", justifyContent: "flex-start", paddingTop: SIZE * 0.12 },
  sheen: {
    width: SIZE * 0.46,
    height: SIZE * 0.46,
    borderRadius: SIZE,
    backgroundColor: "#FFFFFF",
    opacity: 0.18,
  },
});
