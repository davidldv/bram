import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { colors, font, radius, space } from "./theme";

// One transcript line. User = right on a glassy surface; assistant = left with
// an accent tint and a soft accent edge. Springs/fades in on mount.
export function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [anim]);

  const isUser = role === "user";
  return (
    <Animated.View
      style={[
        styles.bubble,
        isUser ? styles.user : styles.assistant,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.text, isUser && styles.userText]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "84%",
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.lg,
    marginVertical: space.xs,
    borderWidth: 1,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderBottomRightRadius: radius.sm,
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(124,140,255,0.15)",
    borderColor: "rgba(124,140,255,0.3)",
    borderBottomLeftRadius: radius.sm,
  },
  text: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  userText: { color: colors.textDim },
});
