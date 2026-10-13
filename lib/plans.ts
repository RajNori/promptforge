// Plan limits — shared by server enforcement and the pricing page.

export type PlanId = "ANON" | "FREE" | "PRO";

export const PLANS: Record<PlanId, { name: string; price: string; period: "day" | "month"; aiActions: number; projects: number; burstPer10m: number; blurb: string; features: string[] }> = {
  ANON: {
    name: "Guest",
    price: "A$0",
    period: "day",
    aiActions: 3,
    projects: 0,
    burstPer10m: 15,
    blurb: "Try it without an account",
    features: ["3 AI generations per day", "Unlimited instant templates", "History in this browser only"],
  },
  FREE: {
    name: "Free",
    price: "A$0",
    period: "month",
    aiActions: 30,
    projects: 10,
    burstPer10m: 40,
    blurb: "For individuals getting started",
    features: ["30 AI generations / refinements per month", "Unlimited AI field autofill", "10 saved prompts, synced", "Last 5 versions + pinning"],
  },
  PRO: {
    name: "Pro",
    price: "A$15",
    period: "month",
    aiActions: 1000,
    projects: 500,
    burstPer10m: 120,
    blurb: "For people who ship prompts daily",
    features: ["1,000 AI generations / refinements per month", "Chain mode & exhaustive depth", "500 saved prompts", "Priority generation", "Early access to team features"],
  },
};

/** Units charged per AI call. Analyze and field autofill are free (burst-limited only). */
export function unitsFor(mode: string, chain: boolean): number {
  if (mode === "generate") return chain ? 2 : 1;
  if (mode === "refine") return 1;
  return 0;
}

export const MAX_UNPINNED_VERSIONS = 5;
