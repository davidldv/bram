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
        <View style={styles.tick} />
        <Text style={styles.title}>{title.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  head: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginRight: space.sm,
  },
  title: {
    color: colors.textDim,
    fontSize: font.small,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.6,
  },
});
