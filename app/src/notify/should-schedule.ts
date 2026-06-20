import type { Plan } from "../core/types";

// Single source of the "does this plan get a notification?" decision.
// Pure so it's testable without the native module.
export function shouldSchedule(plan: Plan, now: number): boolean {
  return plan.scheduledAt != null && plan.scheduledAt > now;
}
