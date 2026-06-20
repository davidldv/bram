import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Plan, PlanType } from "../core/types";
import { colors, font, radius, space, planColor } from "./theme";
import { formatRelative } from "./relative-time";

const ICON: Record<PlanType, keyof typeof Ionicons.glyphMap> = {
  reminder: "notifications-outline",
  event: "calendar-outline",
  task: "checkmark-circle-outline",
};

export function PlanCard({
  plan,
  now,
  onToggleDone,
}: {
  plan: Plan;
  now: number;
  onToggleDone: (id: string) => void;
}) {
  const tint = planColor[plan.type];
  return (
    <Pressable
      onPress={() => onToggleDone(plan.id)}
      style={styles.row}
      accessibilityLabel={`${plan.done ? "Done" : "Mark done"}: ${plan.title}`}
    >
      <View style={[styles.dot, { backgroundColor: plan.done ? colors.hairline : tint + "33" }]}>
        <Ionicons
          name={plan.done ? "checkmark" : ICON[plan.type]}
          size={18}
          color={plan.done ? colors.muted : tint}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, plan.done && styles.doneTitle]} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.time}>{formatRelative(now, plan.scheduledAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.sm,
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.semibold },
  doneTitle: { color: colors.muted, textDecorationLine: "line-through" },
  time: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
