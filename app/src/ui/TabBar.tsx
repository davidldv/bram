import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, space } from "./theme";

export type Tab = "talk" | "agenda" | "graph" | "settings";

type IconName = keyof typeof Ionicons.glyphMap;
const ITEMS: { key: Tab; icon: IconName; iconActive: IconName; label: string }[] = [
  { key: "talk", icon: "mic-outline", iconActive: "mic", label: "Talk" },
  { key: "agenda", icon: "calendar-outline", iconActive: "calendar", label: "Agenda" },
  { key: "graph", icon: "git-network-outline", iconActive: "git-network", label: "Graph" },
  { key: "settings", icon: "settings-outline", iconActive: "settings", label: "Settings" },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const [barWidth, setBarWidth] = useState(0);
  const idx = Math.max(0, ITEMS.findIndex((i) => i.key === active));
  const itemW = barWidth / ITEMS.length;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: idx * itemW,
      useNativeDriver: true,
      speed: 18,
      bounciness: 9,
    }).start();
  }, [idx, itemW, slide]);

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.bar} onLayout={onLayout}>
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: itemW, transform: [{ translateX: slide }] }]}
        >
          <View style={styles.lozenge} />
        </Animated.View>
      )}
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
            <Ionicons
              name={on ? it.iconActive : it.icon}
              size={22}
              color={on ? colors.accent : colors.muted}
            />
            <Text style={[styles.label, { color: on ? colors.accent : colors.muted }]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "rgba(12,14,24,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  indicator: { position: "absolute", top: space.sm, bottom: 0, alignItems: "center", justifyContent: "flex-start" },
  lozenge: {
    width: 56,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "rgba(124,140,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(124,140,255,0.28)",
  },
  item: { flex: 1, alignItems: "center", paddingTop: space.sm, paddingBottom: space.xs },
  label: {
    fontSize: font.micro,
    fontWeight: font.weight.semibold,
    marginTop: space.xs,
    letterSpacing: 0.3,
  },
});
