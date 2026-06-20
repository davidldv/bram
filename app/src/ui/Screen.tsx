import React from "react";
import { View, SafeAreaView, StatusBar, Platform, StyleSheet } from "react-native";
import { colors } from "./theme";

// Android's SafeAreaView ignores the status bar, so pad it manually.
const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

// Full-bleed dark background + safe area. `ambient` paints a soft radial glow
// behind children using layered low-opacity circles (no gradient dependency).
export function Screen({
  children,
  ambient = false,
}: {
  children: React.ReactNode;
  ambient?: boolean;
}) {
  return (
    <SafeAreaView style={styles.root}>
      {ambient && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.glow, styles.glow1]} />
          <View style={[styles.glow, styles.glow2]} />
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base, paddingTop: topInset },
  content: { flex: 1 },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.18 },
  glow1: {
    width: 420,
    height: 420,
    backgroundColor: colors.accent,
    top: "18%",
    alignSelf: "center",
  },
  glow2: {
    width: 300,
    height: 300,
    backgroundColor: colors.accent2,
    top: "30%",
    left: "-10%",
    opacity: 0.12,
  },
});
