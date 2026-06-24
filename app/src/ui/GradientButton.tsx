import React from "react";
import { Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { PressableScale } from "./motion";
import { colors, font, gradients, radius, space } from "./theme";

type Variant = "primary" | "ghost" | "danger";

// One button for the whole app. `primary` fills with the brand gradient,
// `ghost` is a hairline outline, `danger` is a rose outline. Springs on press.
export function GradientButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.btn,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      {primary && !disabled && (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="btn-grad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradients.brand[0]} />
              <Stop offset="1" stopColor={gradients.brand[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={radius.card} fill="url(#btn-grad)" />
        </Svg>
      )}
      <Text
        style={[
          styles.label,
          variant === "danger" && styles.dangerLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.card,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ghost: { borderWidth: 1, borderColor: colors.hairlineStrong },
  danger: { borderWidth: 1, borderColor: "rgba(255,111,135,0.4)" },
  disabled: { backgroundColor: colors.surfaceHi },
  label: { color: "#FFFFFF", fontWeight: font.weight.semibold, fontSize: font.body, letterSpacing: 0.3 },
  dangerLabel: { color: colors.danger },
  disabledLabel: { color: colors.muted },
});
