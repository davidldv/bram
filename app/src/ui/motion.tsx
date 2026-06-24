import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// Fade + rise on mount. Native-driven. `delay` enables list stagger.
export function useEntrance(delay = 0, distance = 14) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 440,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
    ],
  };
}

// Spring scale-in on touch for a tactile, "expensive" feel.
export function usePressScale(to = 0.96) {
  const v = useRef(new Animated.Value(1)).current;
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () =>
      Animated.spring(v, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start(),
    onPressOut: () =>
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 }).start(),
  };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pressable that springs slightly when pressed. One place for the whole app.
export function PressableScale({
  to,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { to?: number; style?: StyleProp<ViewStyle> }) {
  const press = usePressScale(to);
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, press.style]}
    >
      {children}
    </AnimatedPressable>
  );
}
