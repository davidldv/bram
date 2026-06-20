import type { BramApi } from "./api";
import type { PlanRepository } from "./repository";
import { buildCaptureSystemPrompt, parseCapturedPlans } from "./capture";
import type { Plan } from "./types";
import type { Notifier } from "../notify/notifier";
import { shouldSchedule } from "../notify/should-schedule";

export async function capturePlans(
  deps: { api: BramApi; repo: PlanRepository; notifier: Notifier; now: number; newId: () => string },
  utterance: string
): Promise<Plan[]> {
  const system = buildCaptureSystemPrompt(new Date(deps.now).toISOString());
  const reply = await deps.api.chat(system, [{ role: "user", content: utterance }]);
  const plans = parseCapturedPlans(reply, { now: deps.now, newId: deps.newId });
  for (const plan of plans) {
    await deps.repo.add(plan);
    if (shouldSchedule(plan, deps.now)) {
      await deps.notifier.schedule(plan);
    }
  }
  return plans;
}
