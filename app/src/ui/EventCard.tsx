import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalendarEvent } from "../core/types";
import { colors, font, radius, shadow, space } from "./theme";
import { formatRelative } from "./relative-time";
import { useEntrance } from "./motion";

// Read-only row for a device-calendar event (no checkbox / no delete).
export function EventCard({
  event,
  now,
  index = 0,
}: {
  event: CalendarEvent;
  now: number;
  index?: number;
}) {
  const entrance = useEntrance(index * 60);
  const when = event.allDay
    ? "All day"
    : formatRelative(now, event.startMs) +
      (event.endMs
        ? ` – ${formatRelative(now, event.endMs).replace(/^(Today|Tomorrow) /, "")}`
        : "");
  return (
    <Animated.View style={[styles.row, entrance]}>
      <View style={styles.chip}>
        <Ionicons name="calendar-outline" size={19} color={colors.event} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.time}>{when}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.event,
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
    backgroundColor: colors.event + "22",
  },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.semibold },
  time: { color: colors.muted, fontSize: font.small, marginTop: 3 },
});
