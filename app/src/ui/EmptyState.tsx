import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, space } from "./theme";
import { useEntrance } from "./motion";

export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  const entrance = useEntrance(0);
  return (
    <Animated.View style={[styles.wrap, entrance]}>
      <View style={styles.ring}>
        <Ionicons name={icon} size={30} color={colors.textDim} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  ring: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    marginBottom: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: font.weight.semibold,
    marginBottom: space.sm,
  },
  text: {
    color: colors.muted,
    fontSize: font.body,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 280,
  },
});
