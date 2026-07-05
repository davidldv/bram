import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { colors, font, radius, space } from "./theme";

// One transcript line. User = right, on a flat raised surface; assistant =
// left, plain text behind a hairline rule — the voice, not a chat product.
export function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 0 }).start();
  }, [anim]);

  const isUser = role === "user";
  return (
    <Animated.View
      style={[
        isUser ? styles.user : styles.assistant,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.text, isUser && styles.userText]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  user: {
    alignSelf: "flex-end",
    maxWidth: "84%",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md + 2,
    marginVertical: space.xs + 2,
  },
  assistant: {
    alignSelf: "flex-start",
    maxWidth: "84%",
    borderLeftWidth: 2,
    borderLeftColor: colors.hairlineStrong,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    marginVertical: space.xs + 2,
  },
  text: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  userText: { color: colors.textDim },
});
