# Bram UI/UX Redesign — "Calm Ambient Dark"

Date: 2026-06-20
Status: Approved (design); pending implementation plan

## Goal

Replace the placeholder UI (default RN `Button`s, three bare screens, no design
system) with a distinctive, calm, voice-first interface. Voice is the primary
interaction; the visual layer should feel ambient and quiet, not like a chat app.

## Constraints

- **JS-only — zero new native dependencies.** No `react-native-reanimated`,
  `react-native-svg`, `expo-blur`, `expo-linear-gradient`, or `expo-font`.
  Rationale: avoid another painful Gradle/native rebuild; ship via Metro
  hot-reload. Animation uses RN's built-in `Animated`; icons use
  `@expo/vector-icons` (already bundled inside `expo`).
- **Logic untouched.** `runTurn`, repositories (`PlanRepository`,
  `PreferenceRepository`, `TopicRepository`), the voice/speech layer, and the
  backend are not changed by this work. This is a presentation-layer redesign.
- **No data-layer work.** `PlanRepository` already exposes `add`, `list`,
  `listForRange`, `markDone` — enough for the Agenda screen.
- Local-first privacy unchanged (no new egress, no new storage).

## Theme tokens — `src/ui/theme.ts`

Single source of truth for the look. Plain exported object, no dependency.

- Base `#0B0D12` · surface `#161A24` · surface-raised `#1E2330`
- Text `#E8EAF0` · muted `#888FA3` · hairline `#262C3A`
- Accent gradient pair: indigo `#6D7BFF` → violet `#A06BFF`
  (used on the orb and active nav/states; "gradient" rendered via layered
  semi-transparent Views, not a gradient library)
- Plan-type accents: reminder amber `#F5B14C`, event indigo `#6D7BFF`,
  task teal `#4CC8B0`
- Spacing scale: 4 / 8 / 12 / 16 / 24
- Radii: 12 (cards) / 20 (large) / 999 (pill/orb)
- Type sizes: ~14 body / ~18 title / ~28 display; weights 400 / 600 / 700
- Font: system sans (no custom font). `ponytail:` add `expo-font` + a rounded
  display face later only if the system font reads as flat.

## Components — `src/ui/`

Each small, single-purpose, theme-driven. Screens compose these and stay thin.

- **`Screen`** — full-bleed dark background + safe-area wrapper. Optional
  `ambient` flag renders the radial aurora glow (layered absolute Views with
  low opacity and large `borderRadius`) behind children.
- **`Orb`** — the breathing mic button. Props: `state: "idle" | "listening" |
  "thinking" | "speaking"`, `onPress`. Drives a looped `Animated.Value` for
  scale + glow opacity per state (see Voice Home). Disabled while not idle if
  needed by caller.
- **`Bubble`** — a single transcript line. Props: `role`, `text`. User =
  right-aligned muted; assistant = left-aligned accent-tinted. Fades in.
- **`PlanCard`** — one plan row. Props: `plan`, `onToggleDone`. Left type
  dot/icon colored by `plan.type`, title, relative-time label; tap toggles done
  (checkmark + strikethrough).
- **`Section`** — titled group container (used by Settings and Agenda groups).
- **`Card`** — raised surface container primitive.
- **`TabBar`** — custom bottom nav. Raised translucent-dark `View`, 3 items
  (mic/orb · calendar · gear via `@expo/vector-icons`). Active = accent +
  indicator dot; inactive = muted. Props: `active`, `onChange`.

## Screens

### Voice Home (`ConversationScreen`, restyled)
- `Screen ambient` background.
- Centered `Orb` as the mic trigger; state mirrors the existing busy/voice flow:
  idle → listening (during capture) → thinking (during `runTurn`) → speaking
  (during `speaker.speak`) → idle.
  - idle: slow ~4s scale 1.0↔1.06 + glow breathe
  - listening: scale ~1.15, faster pulse, brighter ring
  - thinking: gentle opacity shimmer
  - speaking: pulse loop
- Persona line under the orb: "Tap to talk to {persona}" / "Listening…" /
  "Thinking…" / "{persona} is speaking…".
- Transcript: the last few turns as `Bubble`s above the orb, oldest fading out.
  Not a full scrolling chat log — keeps the screen calm.
- Error text ("Something went wrong reaching the server.", "Sorry, I couldn't
  hear you.") shown as an assistant bubble, unchanged in behavior.

### Agenda (new — `AgendaScreen`)
- Loads plans via `plans.list()` (and/or `listForRange` for the Today bucket).
- Grouped into **Today · Upcoming · Someday** (Someday = `scheduledAt == null`).
  Done plans render struck-through; sort done last within a group (or hide —
  decided in plan).
- Each plan = `PlanCard`; tap calls `plans.markDone(id)` then refreshes.
- Relative-time label: "in 2h", "Tomorrow 9am", "Today 3pm", date otherwise.
- Empty state: calm single line — "Nothing on your plate. Talk to {persona} to
  add something."

### Settings (merge of `TopicsScreen` + `PersonaScreen`)
- One scrolling `Screen` with two `Section`s:
  - **Assistant** — persona name in a dark-styled `TextInput` + Save
    (`getPersonaName` / `setPersonaName`).
  - **News topics** — restyled toggle rows (`topics.list` /
    `topics.setEnabled`), styled `Switch`.

## Navigation — `App.tsx`

Keep the existing simple `useState` tab state machine (no nav library —
ponytail). Tabs become: **talk** (Voice Home) · **agenda** (Agenda) ·
**settings** (Settings). Render the active screen above a custom `TabBar`.
Loading state ("Starting Bram…") restyled to the dark theme.

## Data flow

Unchanged. Screens call the same services from `useServices()`
(`api`, `plans`, `topics`, `prefs`, `voice`, `speaker`, `now`, `newId`) and the
same `runTurn`. The redesign only changes rendering and adds the Agenda read +
markDone wiring (both already supported by `PlanRepository`).

## Error handling

No new error paths. Existing try/catch in the conversation flow is preserved;
errors surface as assistant bubbles. Agenda `markDone` failures are swallowed
quietly (refresh just won't change state) — `ponytail:` add a toast only if it
proves confusing in use.

## Testing

- Existing logic tests (`runTurn`, repos, capture, briefing) must stay green —
  unchanged.
- Add a small unit test for the relative-time formatter (the only non-trivial
  new pure logic) — `assert`-style, e.g. `formatRelative(now, scheduledAt)`
  cases for today/tomorrow/null/past.
- Visual/animation components are verified by running on the emulator
  (hot-reload), not unit-tested.

## Out of scope

- Custom fonts, real blur, SVG/reanimated animation (deferred; see Constraints).
- Editing/deleting plans from the UI (only mark-done). Add later if wanted.
- Theming/light mode — dark only.
- Nav library / deep linking.

## File summary

- New: `src/ui/theme.ts`, `src/ui/Screen.tsx`, `src/ui/Orb.tsx`,
  `src/ui/Bubble.tsx`, `src/ui/PlanCard.tsx`, `src/ui/Section.tsx`,
  `src/ui/Card.tsx`, `src/ui/TabBar.tsx`, `src/screens/AgendaScreen.tsx`,
  `src/ui/relative-time.ts` (+ its test).
- Rewrite: `src/screens/ConversationScreen.tsx`, `App.tsx`.
- Replace: `TopicsScreen.tsx` + `PersonaScreen.tsx` → `SettingsScreen.tsx`
  (old two removed).
- Untouched: everything under `src/core`, `src/db`, `src/speech`, `src/app`
  (services/turn logic), backend.
