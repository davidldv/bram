import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalendarEvent } from "../core/types";
import { colors, font, space } from "./theme";
import { formatRelative } from "./relative-time";
import { useEntrance } from "./motion";

// Read-only row for a device-calendar event — same anatomy as PlanCard, with
// a quiet calendar glyph where the toggle would sit.
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
      <View style={styles.glyph}>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.meta}>EVT · {when}</Text>
      </View>
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
  glyph: { width: 22, alignItems: "center", marginRight: space.md },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.medium },
  meta: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
