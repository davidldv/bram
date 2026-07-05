import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Plan } from "../core/types";
import { colors, font, planTag, space } from "./theme";
import { formatRelative } from "./relative-time";
import { PressableScale, useEntrance } from "./motion";

// Flat agenda row: done-toggle circle, title, mono meta line. Category is the
// mono tag, not a color. Hairline divider under each row.
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
  const entrance = useEntrance(index * 60);
  return (
    <Animated.View style={entrance}>
      <PressableScale
        onPress={() => onToggleDone(plan.id)}
        style={styles.row}
        accessibilityLabel={`${plan.done ? "Done" : "Mark done"}: ${plan.title}`}
      >
        <View style={[styles.toggle, plan.done && styles.toggleDone]}>
          {plan.done ? <Ionicons name="checkmark" size={14} color={colors.muted} /> : null}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, plan.done && styles.doneTitle]} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text style={styles.meta}>
            {planTag[plan.type]} · {formatRelative(now, plan.scheduledAt)}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  toggleDone: { backgroundColor: colors.surfaceHi, borderColor: "transparent" },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.medium },
  doneTitle: { color: colors.muted, textDecorationLine: "line-through" },
  meta: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
