import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, font, space } from "./theme";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  title: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.2,
    marginBottom: space.md,
  },
});
