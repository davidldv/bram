import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalendarEvent } from "../core/types";
import { colors, font, radius, space } from "./theme";
import { formatRelative } from "./relative-time";

// Read-only row for a device-calendar event (no checkbox / no delete).
export function EventCard({ event, now }: { event: CalendarEvent; now: number }) {
  const when = event.allDay
    ? "All day"
    : formatRelative(now, event.startMs) +
      (event.endMs ? ` – ${formatRelative(now, event.endMs).replace(/^(Today|Tomorrow) /, "")}` : "");
  return (
    <View style={styles.row}>
      <View style={styles.dot}>
        <Ionicons name="calendar-outline" size={18} color={colors.event} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.time}>{when}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderLeftWidth: 2,
    borderLeftColor: colors.event,
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
  time: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
