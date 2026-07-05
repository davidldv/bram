import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadow, space } from "./theme";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.lg,
    ...shadow.card,
  },
});
