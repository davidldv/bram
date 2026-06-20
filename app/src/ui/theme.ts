// Single source of truth for the "Calm Ambient Dark" look. No dependencies.
import type { PlanType } from "../core/types";

export const colors = {
  base: "#0B0D12",
  surface: "#161A24",
  surfaceRaised: "#1E2330",
  text: "#E8EAF0",
  muted: "#888FA3",
  hairline: "#262C3A",
  accent: "#6D7BFF",
  accent2: "#A06BFF",
  reminder: "#F5B14C",
  event: "#6D7BFF",
  task: "#4CC8B0",
} as const;

export const planColor: Record<PlanType, string> = {
  reminder: colors.reminder,
  event: colors.event,
  task: colors.task,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = { card: 12, lg: 20, pill: 999 } as const;

export const font = {
  body: 14,
  title: 18,
  display: 28,
  weight: { regular: "400", semibold: "600", bold: "700" },
} as const;
