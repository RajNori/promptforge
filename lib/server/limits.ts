import "server-only";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * AI actions allowed per period for a plan. The guest daily limit can be overridden with
 * AI_GUEST_DAILY_LIMIT (a whole number >= 0), e.g. to lift it on Preview deployments while testing.
 * Unset or invalid falls back to the plan default (3/day), so removing the variable restores it.
 */
export function aiActionsFor(plan: PlanId): number {
  if (plan === "ANON") {
    const raw = process.env.AI_GUEST_DAILY_LIMIT?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) return n;
      console.warn("[limits] ignoring invalid AI_GUEST_DAILY_LIMIT", { raw });
    }
  }
  return PLANS[plan].aiActions;
}
