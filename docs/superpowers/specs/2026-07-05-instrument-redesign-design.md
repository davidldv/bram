# Instrument redesign — visual language replacement

**Date:** 2026-07-05
**Status:** Approved (direction: "Instrument", accent: signal amber)

## Problem

The current "Midnight Aurora" look (indigo→violet→cyan gradients, breathing aurora blobs,
glowing gradient orb, gradient buttons, tinted glass) reads as generic AI-generated design.
This spec replaces the visual language only. Navigation, screen structure, core logic,
tests' behavior contracts, and accessibility labels are unchanged.

## Direction: "Instrument"

Bram should feel like a precision audio instrument — a well-machined dictaphone. Rules:

1. **Structure from hairlines and typography**, not cards-on-cards or tinted fills.
2. **One accent, one job.** Signal amber marks *live/active* state (mic hot, active tab,
   switch on). Never decoration, never category coding.
3. **Zero gradients, zero glow, zero glass.** Flat ink surfaces; borders carry structure.
4. **Monospace meta layer.** Timestamps, dates, tags, status lines, and the wordmark use the
   platform monospace font. This gives the instrument feel with no font dependency.
5. **Damped motion.** Keep the existing entrance/press-scale system; remove bounce
   (critically damped springs).

## Tokens (`app/src/ui/theme.ts` — rewrite)

```ts
colors = {
  base:           "#0A0A0B",   // warm ink black
  surface:        "#131315",
  surfaceRaised:  "#1A1A1D",
  surfaceHi:      "#222226",   // inputs / pressed
  text:           "#F2F2EF",   // warm off-white
  textDim:        "#A9A9A2",
  muted:          "#6E6E67",
  hairline:       "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.13)",
  accent:         "#E8A33D",   // signal amber — live/active only
  danger:         "#D97A70",   // desaturated
}
```

- **Deleted:** `gradients`, `shadow.glow`, `planColor`, and the per-type colors
  (`reminder`, `event`, `task`).
- **Added:** `font.mono = Platform.select({ ios: "Menlo", default: "monospace" })` and
  `planTag: Record<PlanType, string> = { reminder: "REM", event: "EVT", task: "TSK" }`.
- **Radii tighten:** `sm 6, card 10, lg 14, pill 999` (drop `xl`).
- **Shadow:** single subtle `card` shadow (opacity 0.25, radius 12, offset y 6, elevation 3).
- `space` and `font` sizes stay as-is.

Contrast: text (#F2F2EF), textDim (#A9A9A2) on all surfaces ≥ 4.5:1; muted is meta-only.

## Per-file changes

### Deleted
- `ui/AuroraBackground.tsx` — gone entirely.

### `ui/Screen.tsx`
Flat `colors.base` background. `ambient` prop removed; callers updated
(ConversationScreen, AuthFlow).

### `ui/Orb.tsx` — becomes a mic dial (keeps `Orb` name + `OrbState` API)
Flat ink disc (~132 px, `surface` fill, `hairlineStrong` ring) with thin concentric SVG
rings (strokes white 8–14 %) and a small center accent dot. State = ring motion, not glow:

- **idle** — rings still; dot pulses opacity slowly (~2600 ms), muted → accent.
- **listening** — repeating ring tick: a ring scales outward and fades (~900 ms loop);
  dot solid accent.
- **thinking** — a dashed arc ring rotates (~1400 ms, linear); dot dim.
- **speaking** — rings pulse scale on a quick rhythm (~420 ms); dot accent.

Same implementation technique as today: static SVG + native-driven `Animated.View`
transforms/opacity, 2–3 animated values. No halo, no sheen, no radial gradient fill.

### `ui/GradientButton.tsx` → `ui/Button.tsx` (component `Button`, same props API)
- **primary:** solid `#F2F2EF` fill, ink `#0A0A0B` text (no SVG, no gradient).
- **ghost:** `hairlineStrong` border, `text` label.
- **danger:** `rgba(217,122,112,0.4)` border, `danger` label.
- **disabled:** `surfaceHi` fill, `muted` label.
- Radius `card` (10). Update all importers (SettingsScreen, AuthFlow).

### `ui/Bubble.tsx`
- **assistant:** no box — plain text, 2 px `hairlineStrong` left rule, left padding.
- **user:** flat `surfaceRaised`, hairline border, radius `lg`, right-aligned, `textDim`.
- Entrance kept, spring damped (bounciness 0).

### `ui/TabBar.tsx`
Solid `base` background, hairline top. Active item: icon + label in `colors.text`;
inactive: `muted`. The animated lozenge becomes a 24×2 px accent tick at the bar's top
edge that slides to the active item (keep the existing slide spring, damped).

### `ui/Section.tsx`
Accent tick deleted. Title in mono, uppercase, `muted`, letterSpacing 1.5, with a
hairline rule filling the remaining row width.

### `ui/Header.tsx`
Title unchanged (display, bold, tight). Subtitle switches to mono, `muted`,
letterSpacing 0.5.

### `ui/Card.tsx`
`surface` fill, radius `card`, hairline border, subtle shadow. (Used for grouped
settings/auth forms only.)

### `ui/PlanCard.tsx` / `ui/EventCard.tsx` — flat list rows
No per-item card chrome (no background, no colored left border, no icon chip, no shadow).
Row = vertical padding + hairline bottom divider.

- **PlanCard:** 22 px outline circle as the done-toggle (done = filled `surfaceHi` +
  check, undone = `hairlineStrong` outline); title in `text` (done: `muted`,
  strikethrough); meta line below in mono `muted`: `REM · in 2 h` (tag from `planTag` +
  `formatRelative`). Whole row still toggles done; accessibility labels unchanged.
- **EventCard:** same row anatomy, no toggle; small `calendar-outline` glyph in `muted`
  where the circle sits; meta `EVT · <when>`.
- Entrance stagger kept.

### `ui/EmptyState.tsx`
Circle becomes hairline-bordered (`hairlineStrong`), no tinted fill; icon in `textDim`.

### `ui/motion.tsx`
`PressableScale` press-out bounciness 7 → 0. Entrance unchanged.

### `screens/ConversationScreen.tsx`
- Wordmark: `BRAM` — mono, uppercase, letterSpacing 4, `font.small`, `textDim`.
- Welcome copy unchanged; "orb" wording in copy becomes "dial"-neutral ("Tap to talk").
- Status pill → bare row: dot + mono lowercase status. Dot: `muted` when idle,
  `accent` otherwise (single-accent rule replaces the 3-color DOT map).

### `screens/AgendaScreen.tsx`
No structural change; inherits Section/PlanCard/EventCard/Header restyle.

### `screens/SettingsScreen.tsx`
Inherits Card/Section/Button. `Switch` trackColor true = `accent`. Spinner `textDim`.

### `auth/AuthFlow.tsx`
Inherits. Text links: `textDim`, underlined (accent is not for links). Recovery code
block in mono. `Screen ambient` prop dropped.

### `screens/GraphScreen.tsx`
- Node radial gradients + halo circles deleted. Nodes are flat discs in three grey
  tiers: person `#E8E8E4`, goal `#9A9A93`, fact `#5E5E58`, with a `hairline` stroke.
- Edges: single white line, opacity 0.12, width 1.5 (fat indigo underlay deleted).
- Node labels: mono, `muted`.
- Legend: solid `surface`, hairline border, radius `card`; dots in the grey tiers.
- Spinner `textDim`.

### `screens/NodeDetailScreen.tsx`
`TYPE_COLOR` deleted; the type chip becomes a neutral hairline pill with a mono
uppercase tag in `textDim` (category is typography, not color — and the `fact` grey
tier is too dim for text). Back chevron/label: `textDim`. Relation links: `text`
(the chevron is the affordance). Inputs/dividers inherit tokens.

## Out of scope
- `img/` marketing screenshots (regenerate after the redesign ships, separately).
- App icon / splash (`app.json` assets) — separate pass if wanted.
- Light theme — Bram stays dark-only.

## Testing
- Existing Jest suites must pass (`cd app && pnpm test`); behavior contracts and
  accessibility labels are preserved, so no test rewrites are expected beyond any that
  assert on removed exports (`gradients`, `planColor`, `GradientButton` name).
- Visual verification on the Expo dev build: all four tabs, auth modal, node detail,
  empty states, and all four Orb states.
