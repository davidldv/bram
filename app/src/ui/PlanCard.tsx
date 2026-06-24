import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Plan, PlanType } from "../core/types";
import { colors, font, radius, shadow, space, planColor } from "./theme";
import { formatRelative } from "./relative-time";
import { PressableScale, useEntrance } from "./motion";

const ICON: Record<PlanType, keyof typeof Ionicons.glyphMap> = {
  reminder: "notifications-outline",
  event: "calendar-outline",
  task: "checkmark-circle-outline",
};

export function PlanCard({
  plan,
  now,
  onToggleDone,
  index = 0,
}: {
  plan: Plan;
  now: number;
  onToggleDone: (id: string) => void;
  index?: number;
}) {
  const tint = planColor[plan.type];
  const entrance = useEntrance(index * 60);
  return (
    <Animated.View style={entrance}>
      <PressableScale
        onPress={() => onToggleDone(plan.id)}
        style={[styles.row, { borderLeftColor: plan.done ? colors.hairline : tint }]}
        accessibilityLabel={`${plan.done ? "Done" : "Mark done"}: ${plan.title}`}
      >
        <View style={[styles.chip, { backgroundColor: plan.done ? colors.surfaceHi : tint + "22" }]}>
          <Ionicons
            name={plan.done ? "checkmark" : ICON[plan.type]}
            size={19}
            color={plan.done ? colors.muted : tint}
          />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, plan.done && styles.doneTitle]} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text style={styles.time}>{formatRelative(now, plan.scheduledAt)}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    padding: space.md,
    marginBottom: space.sm,
    ...shadow.card,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.semibold },
  doneTitle: { color: colors.muted, textDecorationLine: "line-through" },
  time: { color: colors.muted, fontSize: font.small, marginTop: 3 },
});
