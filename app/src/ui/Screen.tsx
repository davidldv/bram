import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";
import { AuroraBackground } from "./AuroraBackground";

// Full-bleed aurora canvas + safe area. `ambient` brightens the glow toward the
// centre (the voice screen); other screens get the calmer top wash. We only inset
// the top edge — the TabBar owns the bottom edge.
export function Screen({
  children,
  ambient = false,
}: {
  children: React.ReactNode;
  ambient?: boolean;
}) {
  return (
    <View style={styles.root}>
      <AuroraBackground variant={ambient ? "focus" : "default"} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  safe: { flex: 1 },
});
