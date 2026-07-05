# Instrument Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bram's "Midnight Aurora" visual language (gradients, glow, aurora, indigo/violet/cyan) with the approved "Instrument" system: warm ink surfaces, hairline structure, monospace meta layer, one signal-amber accent.

**Architecture:** Pure restyle — no navigation, logic, or test-contract changes. `app/src/ui/theme.ts` is the single source of truth; Task 1 rewrites it with transitional legacy aliases so every intermediate commit compiles and renders coherently; Tasks 2–9 migrate components/screens; Task 10 deletes the aliases and proves nothing references them.

**Tech Stack:** React Native 0.85 / Expo SDK 56, react-native-svg, RN `Animated` (native driver), Jest (jest-expo). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-05-instrument-redesign-design.md`

## Global Constraints

- Work in `app/` (the Expo client). Run all commands from `C:/Users/Alejandro/Dev/bram/app`.
- **No new dependencies.** Monospace = platform font via `Platform.select({ ios: "Menlo", default: "monospace" })`.
- **One accent, one job:** `#E8A33D` marks live/active state only (mic hot, active tab tick, switch on, live dot). Never category coding, never links, never decoration.
- **Zero gradients, zero glow, zero tinted glass.** No `LinearGradient`/`RadialGradient` anywhere in `src/ui` or `src/screens` after Task 9.
- **Accessibility labels and user-facing copy contracts are preserved** — tests assert on `accessibilityLabel="Talk"`, button labels, and message text. Do not rename labels.
- Verification per task: `pnpm typecheck` then `pnpm test` — both must pass before every commit. (Pure restyle: the existing suite + typecheck is the regression net; no new style tests — asserting on styles is test theater.)
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Theme tokens

**Files:**
- Modify: `app/src/ui/theme.ts` (full rewrite)

**Interfaces:**
- Produces (used by all later tasks): `colors` (`base, surface, surfaceRaised, surfaceHi, text, textDim, muted, hairline, hairlineStrong, accent, danger`), `planTag: Record<PlanType, string>`, `entityTier: { person, goal, fact }`, `space` (unchanged), `radius` (`sm 6, card 10, lg 14, pill 999`), `font` (sizes unchanged + `font.mono: string`), `shadow.card`.
- Keeps transitional legacy exports (`planColor`, `gradients`, `colors.reminder/event/task/accent2/accentCyan`) so unmigrated files compile; Task 10 deletes them.

- [ ] **Step 1: Rewrite `app/src/ui/theme.ts`**

```ts
// Single source of truth for Bram's look — "Instrument": a precision audio
// instrument. Warm ink surfaces, structure from hairlines and typography, a
// monospace meta layer, and one signal-amber accent reserved for live/active
// state. No gradients, no glow, no tinted glass.
import { Platform } from "react-native";
import type { PlanType } from "../core/types";

export const colors = {
  // Ink backdrop + layered surfaces
  base: "#0A0A0B",
  surface: "#131315",
  surfaceRaised: "#1A1A1D",
  surfaceHi: "#222226",
  // Text — warm grey ramp
  text: "#F2F2EF",
  textDim: "#A9A9A2",
  muted: "#6E6E67",
  // Lines / dividers (translucent so they read on any surface)
  hairline: "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.13)",
  // The one accent: live/active state only (mic hot, active tab, switch on).
  accent: "#E8A33D",
  danger: "#D97A70",
  // ── Transitional aliases (Midnight Aurora migration) — deleted in the
  // final cleanup task. Do not add new usages.
  reminder: "#E8A33D",
  event: "#A9A9A2",
  task: "#6E6E67",
  accent2: "#E8A33D",
  accentCyan: "#F2F2EF",
} as const;

// Category is typography, not color: a monospace tag per plan type.
export const planTag: Record<PlanType, string> = {
  reminder: "REM",
  event: "EVT",
  task: "TSK",
};

// Graph entity types in grey tiers — brightness = prominence, not hue.
export const entityTier = {
  person: "#E8E8E4",
  goal: "#9A9A93",
  fact: "#5E5E58",
} as const;

// Transitional — deleted in the final cleanup task.
export const planColor: Record<PlanType, string> = {
  reminder: colors.accent,
  event: colors.textDim,
  task: colors.muted,
};

// Transitional — deleted in the final cleanup task.
export const gradients = {
  brand: [colors.accent, colors.accent] as const,
  brandWide: [colors.text, colors.accent, colors.accent] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

export const radius = { sm: 6, card: 10, lg: 14, pill: 999 } as const;

export const font = {
  micro: 11,
  small: 12,
  body: 14,
  title: 18,
  large: 22,
  display: 30,
  hero: 40,
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  // The meta layer: timestamps, tags, status lines, section labels, wordmark.
  mono: Platform.select({ ios: "Menlo", default: "monospace" }) as string,
} as const;

// One subtle elevation for grouped cards. Borders carry structure; no glow.
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;
```

Note: `shadow.glow` and `radius.xl` are deleted immediately (grep shows no consumers).

- [ ] **Step 2: Verify**

Run: `pnpm typecheck` — expected: clean exit.
Run: `pnpm test` — expected: all suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/theme.ts
git commit -m "feat(ui): Instrument design tokens — ink palette, amber accent, mono meta layer"
```

---

### Task 2: Flat canvas — Screen, delete AuroraBackground, App loading state

**Files:**
- Modify: `app/src/ui/Screen.tsx` (full rewrite)
- Delete: `app/src/ui/AuroraBackground.tsx`
- Modify: `app/App.tsx` (drop `ambient`, restyle loading brand)
- Modify: `app/src/screens/ConversationScreen.tsx:75` (drop `ambient`)
- Modify: `app/src/auth/AuthFlow.tsx:66` (drop `ambient`)

**Interfaces:**
- Produces: `Screen({ children })` — the `ambient` prop is **removed**; all later tasks use plain `<Screen>`.

- [ ] **Step 1: Rewrite `app/src/ui/Screen.tsx`**

```tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

// Flat ink canvas + safe area. We only inset the top edge — the TabBar owns
// the bottom edge.
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
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
```

- [ ] **Step 2: Delete the aurora**

```bash
git rm src/ui/AuroraBackground.tsx
```

Then delete the `baseElev` transitional alias from `src/ui/theme.ts` (Task 1 kept it
solely because `AuroraBackground.tsx` still read it; this deletion removes its only
consumer).

- [ ] **Step 3: Drop `ambient` at the three call sites**

In `src/screens/ConversationScreen.tsx`: `<Screen ambient>` → `<Screen>`.
In `src/auth/AuthFlow.tsx`: `<Screen ambient>` → `<Screen>`.
In `App.tsx`: `<Screen ambient>` → `<Screen>`.

- [ ] **Step 4: Restyle the App.tsx loading brand (mono wordmark)**

In `App.tsx` replace the `brand` and `loadingText` styles:

```ts
  brand: {
    color: colors.textDim,
    fontSize: font.title,
    fontFamily: font.mono,
    letterSpacing: 6,
    marginTop: space.xl,
  },
  loadingText: {
    color: colors.muted,
    fontSize: font.small,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
```

And change the brand text `Bram` → `BRAM` (the JSX line `<Text style={styles.brand}>Bram</Text>` → `<Text style={styles.brand}>BRAM</Text>`).

- [ ] **Step 5: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): flat ink canvas — delete aurora background, drop ambient prop"
```

---

### Task 3: Button (replaces GradientButton) + damped motion

**Files:**
- Create: `app/src/ui/Button.tsx`
- Delete: `app/src/ui/GradientButton.tsx`
- Modify: `app/src/screens/SettingsScreen.tsx`, `app/src/auth/AuthFlow.tsx`, `app/src/screens/NodeDetailScreen.tsx` (imports + JSX tag rename)
- Modify: `app/src/ui/motion.tsx:41` (damp press-out spring)

**Interfaces:**
- Produces: `Button({ label, onPress, disabled?, accessibilityLabel?, variant?: "primary" | "ghost" | "danger", style? })` — identical props API to the old `GradientButton`.

- [ ] **Step 1: Create `app/src/ui/Button.tsx`**

```tsx
import React from "react";
import { Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "./motion";
import { colors, font, radius, space } from "./theme";

type Variant = "primary" | "ghost" | "danger";

// One button for the whole app. `primary` is solid off-white with ink text,
// `ghost` is a hairline outline, `danger` is a desaturated red outline.
export function Button({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary" && !disabled;
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.btn,
        primary && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          primary && styles.primaryLabel,
          variant === "danger" && styles.dangerLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.card,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.text },
  ghost: { borderWidth: 1, borderColor: colors.hairlineStrong },
  danger: { borderWidth: 1, borderColor: "rgba(217,122,112,0.4)" },
  disabled: { backgroundColor: colors.surfaceHi },
  label: {
    color: colors.text,
    fontWeight: font.weight.semibold,
    fontSize: font.body,
    letterSpacing: 0.2,
  },
  primaryLabel: { color: colors.base },
  dangerLabel: { color: colors.danger },
  disabledLabel: { color: colors.muted },
});
```

- [ ] **Step 2: Migrate the three importers**

In `src/screens/SettingsScreen.tsx`, `src/auth/AuthFlow.tsx`, `src/screens/NodeDetailScreen.tsx`:
- Replace `import { GradientButton } from "../ui/GradientButton";` with `import { Button } from "../ui/Button";`
- Replace every `<GradientButton` with `<Button` (9 usages in SettingsScreen, 6 in AuthFlow, 2 in NodeDetailScreen). All props are unchanged.

Then:

```bash
git rm src/ui/GradientButton.tsx
```

- [ ] **Step 3: Damp the press spring**

In `src/ui/motion.tsx`, in `usePressScale`'s `onPressOut`:
`Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 })` → `bounciness: 0`.

- [ ] **Step 4: Verify no stragglers**

Run: `grep -rn "GradientButton" src App.tsx` — expected: no matches.
Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass (tests find buttons by accessibility label, unchanged).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): solid ink-on-white Button replaces GradientButton; damp press spring"
```

---

### Task 4: Orb → mic dial

**Files:**
- Modify: `app/src/ui/Orb.tsx` (full rewrite)

**Interfaces:**
- Consumes: `colors` from Task 1.
- Produces: `Orb({ state: OrbState, onPress, disabled? })` and `type OrbState = "idle" | "listening" | "thinking" | "speaking"` — identical API; `ConversationScreen` and `App.tsx` need no changes. `accessibilityLabel="Talk"` preserved (test contract).

- [ ] **Step 1: Rewrite `app/src/ui/Orb.tsx`**

```tsx
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "./theme";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const SIZE = 132;
const WRAP = Math.round(SIZE * 1.6);
const R = SIZE / 2;

// Half-cycle of the ping-pong pulse per state, ms.
const PULSE_MS: Record<OrbState, number> = {
  idle: 2600,
  listening: 900,
  thinking: 1000,
  speaking: 420,
};

// A flat mic dial. State is expressed by ring motion, not glow: idle breathes
// the center dot, listening ticks a ring outward, thinking rotates a dashed
// arc, speaking pulses the disc on a quick rhythm. All motion native-driven.
export function Orb({
  state,
  onPress,
  disabled,
}: {
  state: OrbState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current; // ping-pong 0↔1
  const sweep = useRef(new Animated.Value(0)).current; // sawtooth 0→1

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS[state],
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_MS[state],
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  useEffect(() => {
    sweep.setValue(0);
    const listening = state === "listening";
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: listening ? 900 : 1400,
        easing: listening ? Easing.out(Easing.quad) : Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [state, sweep]);

  const discScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: state === "speaking" ? [1, 1.05] : [1, 1],
  });
  const dotOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      state === "idle" ? [0.3, 1] : state === "thinking" ? [0.35, 0.35] : [1, 1],
  });
  const tickScale = sweep.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const tickOpacity = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel="Talk" hitSlop={24}>
      <View style={styles.wrap}>
        {/* Listening: a thin ring ticks outward and fades */}
        {state === "listening" && (
          <Animated.View
            style={[styles.layer, { opacity: tickOpacity, transform: [{ scale: tickScale }] }]}
            pointerEvents="none"
          >
            <Svg width={WRAP} height={WRAP}>
              <Circle
                cx={WRAP / 2}
                cy={WRAP / 2}
                r={R}
                stroke="#FFFFFF"
                strokeOpacity={0.8}
                strokeWidth={1}
                fill="none"
              />
            </Svg>
          </Animated.View>
        )}

        {/* The dial: flat disc, hairline rim, static concentric rings */}
        <Animated.View style={{ transform: [{ scale: discScale }] }}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={R}
              cy={R}
              r={R - 1}
              fill={colors.surface}
              stroke={colors.hairlineStrong}
              strokeWidth={1}
            />
            <Circle cx={R} cy={R} r={R * 0.72} stroke="rgba(255,255,255,0.10)" strokeWidth={1} fill="none" />
            <Circle cx={R} cy={R} r={R * 0.48} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
          </Svg>

          {/* Thinking: a dashed arc rotates */}
          {state === "thinking" && (
            <Animated.View
              style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
              pointerEvents="none"
            >
              <Svg width={SIZE} height={SIZE}>
                <Circle
                  cx={R}
                  cy={R}
                  r={R * 0.6}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1.5}
                  strokeDasharray="4 10"
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
          )}

          {/* Center dot — the only color on the dial */}
          <View style={styles.dotWrap} pointerEvents="none">
            <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WRAP, height: WRAP, alignItems: "center", justifyContent: "center" },
  layer: {
    position: "absolute",
    width: WRAP,
    height: WRAP,
    alignItems: "center",
    justifyContent: "center",
  },
  dotWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck` — clean.
Run: `pnpm test __tests__/ConversationScreen.test.tsx` — passes (`getByLabelText("Talk")` intact).
Run: `pnpm test` — all pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Orb.tsx
git commit -m "feat(ui): Orb becomes a flat mic dial — ring motion replaces glow"
```

---

### Task 5: ConversationScreen chrome + Bubble

**Files:**
- Modify: `app/src/screens/ConversationScreen.tsx`
- Modify: `app/src/ui/Bubble.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Orb`/`OrbState` (Task 4), `Screen` (Task 2), `font.mono` (Task 1).
- Produces: `Bubble({ role, text })` — unchanged API.

- [ ] **Step 1: Edit `app/src/screens/ConversationScreen.tsx`**

Replace the `STATUS` and `DOT` constants (lines 16–28) with:

```tsx
const STATUS: Record<OrbState, (name: string) => string> = {
  idle: (n) => `tap to talk to ${n}`,
  listening: () => "listening…",
  thinking: () => "thinking…",
  speaking: (n) => `${n} is speaking…`,
};
```

In the JSX: wordmark text `Bram` → `BRAM`; welcome sub copy `Tap the orb and tell me anything` → `Tap the dial and tell me anything` (rest of the sentence unchanged). Replace the status pill block:

```tsx
        <View style={styles.stage}>
          <Orb state={orb} onPress={onTalk} disabled={orb !== "idle"} />
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: orb === "idle" ? colors.muted : colors.accent },
              ]}
            />
            <Text style={styles.status}>{STATUS[orb](persona)}</Text>
          </View>
        </View>
```

Replace the `wordmark`, `statusPill`, `dot`, `status` styles with:

```ts
  wordmark: {
    color: colors.textDim,
    fontSize: font.small,
    fontFamily: font.mono,
    letterSpacing: 4,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: space.sm },
  status: {
    color: colors.textDim,
    fontSize: font.small,
    fontFamily: font.mono,
    letterSpacing: 0.5,
  },
```

(`radius` import becomes unused — remove it from the theme import.)

- [ ] **Step 2: Rewrite `app/src/ui/Bubble.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass (ConversationScreen test asserts on message text and the Talk label, both intact).

- [ ] **Step 4: Commit**

```bash
git add src/screens/ConversationScreen.tsx src/ui/Bubble.tsx
git commit -m "feat(ui): mono wordmark + bare status line; hairline-rule transcript"
```

---

### Task 6: Chrome kit — TabBar, Section, Header, Card, EmptyState

**Files:**
- Modify: `app/src/ui/TabBar.tsx`, `app/src/ui/Section.tsx`, `app/src/ui/Header.tsx`, `app/src/ui/Card.tsx`, `app/src/ui/EmptyState.tsx`

**Interfaces:**
- All component APIs unchanged.

- [ ] **Step 1: TabBar — sliding amber tick at the bar's top edge**

In `app/src/ui/TabBar.tsx`:

Change the spring to damped: `bounciness: 9` → `bounciness: 0` (keep `speed: 18`).

Replace the indicator JSX (`<View style={styles.lozenge} />` block) with:

```tsx
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: itemW, transform: [{ translateX: slide }] }]}
        >
          <View style={styles.tick} />
        </Animated.View>
      )}
```

Change active item colors from `colors.accent` to `colors.text` (both the `Ionicons` `color` and the label `color`):

```tsx
            <Ionicons
              name={on ? it.iconActive : it.icon}
              size={22}
              color={on ? colors.text : colors.muted}
            />
            <Text style={[styles.label, { color: on ? colors.text : colors.muted }]}>
```

Replace the styles:

```ts
const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  indicator: { position: "absolute", top: 0, alignItems: "center" },
  tick: { width: 24, height: 2, backgroundColor: colors.accent },
  item: { flex: 1, alignItems: "center", paddingTop: space.sm, paddingBottom: space.xs },
  label: {
    fontSize: font.micro,
    fontWeight: font.weight.semibold,
    marginTop: space.xs,
    letterSpacing: 0.3,
  },
});
```

(`radius` import becomes unused — remove it.)

- [ ] **Step 2: Section — mono label + hairline rule (accent tick deleted)**

Rewrite `app/src/ui/Section.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, font, space } from "./theme";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <View style={styles.rule} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: space.md,
    gap: space.md,
  },
  title: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 1.5,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
});
```

- [ ] **Step 3: Header — mono subtitle**

In `app/src/ui/Header.tsx`, replace the `subtitle` style:

```ts
  subtitle: {
    color: colors.muted,
    fontSize: font.small,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: space.sm,
  },
```

- [ ] **Step 4: Card — tighter radius (token change only)**

In `app/src/ui/Card.tsx`, change `borderRadius: radius.lg` → `borderRadius: radius.card`. (Colors/shadow update automatically via Task 1 tokens.)

- [ ] **Step 5: EmptyState — hairline ring, no tint**

In `app/src/ui/EmptyState.tsx`: icon color `colors.accent` → `colors.textDim`; replace the `ring` style:

```ts
  ring: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    marginBottom: space.lg,
  },
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/TabBar.tsx src/ui/Section.tsx src/ui/Header.tsx src/ui/Card.tsx src/ui/EmptyState.tsx
git commit -m "feat(ui): instrument chrome — amber tab tick, mono section labels, hairline empty state"
```

---

### Task 7: Agenda rows — PlanCard + EventCard

**Files:**
- Modify: `app/src/ui/PlanCard.tsx` (full rewrite)
- Modify: `app/src/ui/EventCard.tsx` (full rewrite)

**Interfaces:**
- Consumes: `planTag` from Task 1, `formatRelative(now, ms)` from `./relative-time` (existing).
- Produces: unchanged APIs — `PlanCard({ plan, now, onToggleDone, index? })`, `EventCard({ event, now, index? })`. Accessibility labels preserved.

- [ ] **Step 1: Rewrite `app/src/ui/PlanCard.tsx`**

```tsx
import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Plan } from "../core/types";
import { colors, font, planTag, space } from "./theme";
import { formatRelative } from "./relative-time";
import { PressableScale, useEntrance } from "./motion";

// Flat agenda row: done-toggle circle, title, mono meta line. Category is the
// mono tag, not a color. Hairline divider under each row.
export function PlanCard({
  plan,
  now,
  onToggleDone,
  index = 0,
}: {
  plan: Plan;
  now: number;
  onToggleDone: (id: string) => void;
  index?: number;
}) {
  const entrance = useEntrance(index * 60);
  return (
    <Animated.View style={entrance}>
      <PressableScale
        onPress={() => onToggleDone(plan.id)}
        style={styles.row}
        accessibilityLabel={`${plan.done ? "Done" : "Mark done"}: ${plan.title}`}
      >
        <View style={[styles.toggle, plan.done && styles.toggleDone]}>
          {plan.done ? <Ionicons name="checkmark" size={14} color={colors.muted} /> : null}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, plan.done && styles.doneTitle]} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text style={styles.meta}>
            {planTag[plan.type]} · {formatRelative(now, plan.scheduledAt)}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  toggleDone: { backgroundColor: colors.surfaceHi, borderColor: "transparent" },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.medium },
  doneTitle: { color: colors.muted, textDecorationLine: "line-through" },
  meta: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Rewrite `app/src/ui/EventCard.tsx`**

```tsx
import React from "react";
import { Animated, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CalendarEvent } from "../core/types";
import { colors, font, space } from "./theme";
import { formatRelative } from "./relative-time";
import { useEntrance } from "./motion";

// Read-only row for a device-calendar event — same anatomy as PlanCard, with
// a quiet calendar glyph where the toggle would sit.
export function EventCard({
  event,
  now,
  index = 0,
}: {
  event: CalendarEvent;
  now: number;
  index?: number;
}) {
  const entrance = useEntrance(index * 60);
  const when = event.allDay
    ? "All day"
    : formatRelative(now, event.startMs) +
      (event.endMs
        ? ` – ${formatRelative(now, event.endMs).replace(/^(Today|Tomorrow) /, "")}`
        : "");
  return (
    <Animated.View style={[styles.row, entrance]}>
      <View style={styles.glyph}>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.meta}>EVT · {when}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  glyph: { width: 22, alignItems: "center", marginRight: space.md },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: font.body, fontWeight: font.weight.medium },
  meta: {
    color: colors.muted,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/PlanCard.tsx src/ui/EventCard.tsx
git commit -m "feat(ui): agenda cards become flat hairline rows with mono REM/EVT/TSK tags"
```

---

### Task 8: Settings, AuthFlow, NodeDetail details

**Files:**
- Modify: `app/src/screens/SettingsScreen.tsx` (spinner color)
- Modify: `app/src/auth/AuthFlow.tsx` (spinner, links, mono code)
- Modify: `app/src/screens/NodeDetailScreen.tsx` (type chip, back button, links)

**Interfaces:** none new; inherits Task 1–7 components.

- [ ] **Step 1: SettingsScreen**

Line 206: `<ActivityIndicator ... color={colors.accent} ...>` → `color={colors.textDim}`. (Switch already reads `colors.accent` for its on-state — correct: a switch that's on is live.)

- [ ] **Step 2: AuthFlow**

- Spinner (line 95): `color={colors.accent}` → `color={colors.textDim}`.
- `link` style: `{ color: colors.accent, fontSize: font.body }` → `{ color: colors.textDim, fontSize: font.body, textDecorationLine: "underline" }`.
- `code` style — make it mono and drop the bold:

```ts
  code: {
    color: colors.text,
    fontSize: font.body,
    fontFamily: font.mono,
    letterSpacing: 1,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.md,
  },
```

- [ ] **Step 3: NodeDetailScreen**

- Delete the `TYPE_COLOR` constant (lines 13–17) and the `tint` variable (line 82).
- Back button: chevron `color={colors.accent}` → `color={colors.textDim}`; `back` style color `colors.accent` → `colors.textDim`.
- Type chip — static hairline pill with a mono tag. JSX:

```tsx
              <View style={styles.chip}>
                <Text style={styles.chipText}>{entity.type}</Text>
              </View>
```

Styles:

```ts
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chipText: {
    color: colors.textDim,
    fontSize: font.micro,
    fontFamily: font.mono,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
```

- Neighbor links: `link` style color `colors.accent` → `colors.text` (the chevron is the affordance).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass (SettingsAccount/SettingsBackup/AuthFlow tests find controls by label/text, unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/auth/AuthFlow.tsx src/screens/NodeDetailScreen.tsx
git commit -m "feat(ui): de-accent settings/auth/node-detail — accent stays reserved for live state"
```

---

### Task 9: Graph — grey tiers, quiet edges

**Files:**
- Modify: `app/src/screens/GraphScreen.tsx`

**Interfaces:**
- Consumes: `entityTier` from Task 1.

- [ ] **Step 1: Edit `app/src/screens/GraphScreen.tsx`**

- SVG imports: `import Svg, { G, Line, Circle, Text as SvgText } from "react-native-svg";` (drop `Defs`, `RadialGradient`, `Stop`).
- Theme import: `import { colors, entityTier, font, radius, space } from "../ui/theme";`
- Delete the local `NODE_COLOR` constant; use `entityTier` everywhere it appeared (legend dots, node fills).
- Delete the whole `<Defs>…</Defs>` block.
- Edges — replace the two-`<Line>` fragment with a single quiet line:

```tsx
              return (
                <Line
                  key={i}
                  x1={na.x ?? 0}
                  y1={na.y ?? 0}
                  x2={nb.x ?? 0}
                  y2={nb.y ?? 0}
                  stroke="#FFFFFF"
                  strokeOpacity={0.12}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
```

- Nodes — delete the halo `<Circle … fillOpacity={0.14} />`; the node circle becomes a flat tier-grey disc, and the label goes mono:

```tsx
                <React.Fragment key={n.id}>
                  <Circle
                    cx={n.x ?? 0}
                    cy={n.y ?? 0}
                    r={r}
                    fill={entityTier[n.type]}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                    onPress={() => onSelect(n.id)}
                  />
                  <SvgText
                    x={n.x ?? 0}
                    y={(n.y ?? 0) + r + 14}
                    fill={colors.muted}
                    fontSize={10}
                    fontFamily={font.mono}
                    textAnchor="middle"
                  >
                    {n.name}
                  </SvgText>
                </React.Fragment>
```

- Spinner: `color={colors.accent}` → `color={colors.textDim}`.
- Legend styles: `backgroundColor: "rgba(16,19,31,0.8)"` → `colors.surface`; `borderRadius: radius.pill` → `radius.card`; legend dot backgrounds now come from `entityTier`.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck` — clean. Run: `pnpm test` — all pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/GraphScreen.tsx
git commit -m "feat(ui): graph in grey tiers — flat discs, quiet edges, mono labels"
```

---

### Task 10: Delete transitional aliases + final verification

**Files:**
- Modify: `app/src/ui/theme.ts` (delete aliases)

- [ ] **Step 1: Prove the aliases are dead**

Run:
```bash
grep -rn "planColor\|gradients\|accent2\|accentCyan\|baseElev\|colors\.reminder\|colors\.event\|colors\.task" src App.tsx
```
Expected: matches only inside `src/ui/theme.ts` (the alias definitions themselves). If anything else matches, migrate it first — do not delete exports that are still consumed.

- [ ] **Step 2: Delete from `theme.ts`**

Remove: the five alias color keys (`reminder`, `event`, `task`, `accent2`, `accentCyan`) and their comment block, plus the `planColor` and `gradients` exports and their comments.

- [ ] **Step 3: Full verification**

Run: `pnpm typecheck` — clean (this is the machine-checked proof no consumer was missed).
Run: `pnpm test` — all suites pass.
Run: `grep -rn "LinearGradient\|RadialGradient" src` — expected: no matches (constraint: zero gradients).

- [ ] **Step 4: Commit**

```bash
git add src/ui/theme.ts
git commit -m "chore(ui): drop Midnight Aurora transitional aliases — Instrument migration complete"
```

---

## Post-plan (manual, not tasks)

- Visual pass on the Expo dev build (`pnpm start`): all four tabs, auth modal, node detail, empty states, and all four dial states (idle/listening/thinking/speaking), plus the App.tsx loading state.
- `img/` marketing screenshots and app icon/splash are explicitly out of scope (spec) — regenerate separately.
