import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { colors, font, radius, space } from "./theme";

// One transcript line. User = right + muted surface, assistant = left + accent
// tint. Fades/slides in on mount.
export function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
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
  bubble: {
    maxWidth: "85%",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    marginVertical: space.xs,
  },
  user: { alignSelf: "flex-end", backgroundColor: colors.surfaceRaised },
  assistant: { alignSelf: "flex-start", backgroundColor: "rgba(109,123,255,0.16)" },
  text: { color: colors.text, fontSize: font.body, lineHeight: 20 },
  userText: { color: colors.muted },
});
