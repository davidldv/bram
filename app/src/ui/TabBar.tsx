import React from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space } from "./theme";

export type Tab = "talk" | "agenda" | "settings";

const ITEMS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "talk", icon: "mic", label: "Talk" },
  { key: "agenda", icon: "calendar", label: "Agenda" },
  { key: "settings", icon: "settings", label: "Settings" },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={styles.bar}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={styles.item}
            accessibilityLabel={it.label}
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={it.icon} size={24} color={on ? colors.accent : colors.muted} />
            <View style={[styles.dot, { opacity: on ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingVertical: space.sm,
  },
  item: { flex: 1, alignItems: "center", paddingVertical: space.xs },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: space.xs,
  },
});
