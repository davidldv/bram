import React from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { colors, font, space } from "./theme";
import { useEntrance } from "./motion";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const entrance = useEntrance(0);
  return (
    <Animated.View style={[styles.wrap, entrance]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  title: {
    color: colors.text,
    fontSize: font.display,
    fontWeight: font.weight.bold,
    letterSpacing: -0.5,
  },
  subtitle: { color: colors.muted, fontSize: font.body, marginTop: space.xs },
});
