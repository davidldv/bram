// Single source of truth for Bram's look — "Midnight Aurora": a deep, calm
// dark canvas lit by an indigo→violet→cyan brand glow. No dependencies; all
// gradients are drawn with react-native-svg (already linked for the graph).
import type { PlanType } from "../core/types";

export const colors = {
  // Backdrop (top→bottom wash lives in AuroraBackground)
  base: "#070810",
  baseElev: "#0C0E1A",
  // Layered surfaces
  surface: "#10131F",
  surfaceRaised: "#161A2A",
  surfaceHi: "#1D2235",
  // Text
  text: "#F3F4FA",
  textDim: "#AEB4CC",
  muted: "#737B95",
  // Lines / dividers (translucent so they read on any surface)
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  // Brand
  accent: "#7C8CFF", // indigo (primary)
  accent2: "#B98CFF", // violet
  accentCyan: "#5BE3E8", // cyan glint
  // Semantic — keep as hex (composed with alpha suffixes elsewhere, e.g. tint+"22")
  reminder: "#FFB23E",
  event: "#7C8CFF",
  task: "#41D9B4",
  danger: "#FF6F87",
} as const;

export const planColor: Record<PlanType, string> = {
  reminder: colors.reminder,
  event: colors.event,
  task: colors.task,
};

// Two-stop brand gradient (buttons, accents); wide three-stop for the Orb.
export const gradients = {
  brand: [colors.accent, colors.accent2] as const,
  brandWide: [colors.accentCyan, colors.accent, colors.accent2] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

export const radius = { sm: 10, card: 16, lg: 22, xl: 28, pill: 999 } as const;

export const font = {
  micro: 11,
  small: 12,
  body: 14,
  title: 18,
  large: 22,
  display: 30,
  hero: 40,
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
} as const;

// Soft elevation for raised cards / floating controls. Subtle on dark.
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;
