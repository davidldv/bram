import React from "react";
import { View, SafeAreaView, StatusBar, Platform, StyleSheet } from "react-native";
import { colors } from "./theme";
import { AuroraBackground } from "./AuroraBackground";

// Android's SafeAreaView ignores the status bar, so pad it manually.
const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

// Full-bleed aurora canvas + safe area. `ambient` brightens the glow toward the
// centre (the voice screen); other screens get the calmer top wash.
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
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { paddingTop: topInset }]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  safe: { flex: 1 },
  content: { flex: 1 },
});
