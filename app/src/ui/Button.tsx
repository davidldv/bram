import React from "react";
import { Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "./motion";
import { colors, font, radius, space } from "./theme";

type Variant = "primary" | "ghost" | "danger";

// One button for the whole app. `primary` is solid off-white with ink text,
// `ghost` is a hairline outline, `danger` is a desaturated red outline.
export function Button({
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
  const primary = variant === "primary" && !disabled;
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.btn,
        primary && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          primary && styles.primaryLabel,
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
  },
  primary: { backgroundColor: colors.text },
  ghost: { borderWidth: 1, borderColor: colors.hairlineStrong },
  danger: { borderWidth: 1, borderColor: colors.danger + "66" },
  disabled: { backgroundColor: colors.surfaceHi },
  label: {
    color: colors.text,
    fontWeight: font.weight.semibold,
    fontSize: font.body,
    letterSpacing: 0.2,
  },
  primaryLabel: { color: colors.base },
  dangerLabel: { color: colors.danger },
  disabledLabel: { color: colors.muted },
});
