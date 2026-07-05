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
