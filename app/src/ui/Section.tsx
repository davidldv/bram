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
      <View style={styles.head}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <View style={styles.rule} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.md,
    gap: space.md,
  },
  title: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 1.5,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
});
