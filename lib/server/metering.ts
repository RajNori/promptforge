import "server-only";
import { db } from "./db";
import { periodStart, type Viewer } from "./account";
import { PLANS } from "@/lib/plans";

type Check = { ok: true } | { ok: false; status: number; error: string; code: "burst" | "quota" | "auto" };

// In-memory fallback when no database is configured (per instance, best-effort).
const mem = new Map<string, number[]>();

/**
 * Enforce burst rate limit, auto-repair allowance and the plan quota before an AI call.
 * DB-backed so limits hold across serverless instances.
 */
/** Live hints fire as people type: their own budget, so they never block a real generation. */
const HINTS_PER_10M = 40;

export async function precheck(v: Viewer, units: number, auto: boolean, mode?: string): Promise<Check> {
  const plan = PLANS[v.plan];
  const hints = mode === "hints";
  const limit = hints ? HINTS_PER_10M : plan.burstPer10m;
  const prisma = db();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  if (!prisma) {
    const now = Date.now();
    const memKey = hints ? `${v.subject}:hints` : v.subject;
    const arr = (mem.get(memKey) ?? []).filter((t) => now - t < 600_000);
    arr.push(now);
    mem.set(memKey, arr);
    return arr.length > limit ? { ok: false, status: 429, error: "Too many requests. Try again in a few minutes.", code: "burst" } : { ok: true };
  }

  const recent = await prisma.usageEvent.groupBy({
    by: ["mode"],
    where: { subject: v.subject, createdAt: { gte: tenMinAgo } },
    _count: { _all: true },
    _sum: { units: true },
  });
  const calls = recent.filter((r) => (r.mode === "hints") === hints).reduce((n, r) => n + r._count._all, 0);
  if (calls >= limit) return { ok: false, status: 429, error: "Too many requests. Try again in a few minutes.", code: "burst" };

  if (auto) {
    // Free auto-repairs are only allowed in proportion to paid calls — stops clients flagging everything as "auto".
    const autos = recent.find((r) => r.mode === "auto")?._count._all ?? 0;
    const paid = recent.filter((r) => r.mode === "generate" || r.mode === "refine").reduce((n, r) => n + r._count._all, 0);
    if (autos >= paid * 2) return { ok: false, status: 429, error: "Auto-fix limit reached. Refine manually.", code: "auto" };
    return { ok: true };
  }

  if (units > 0) {
    const used = (
      await prisma.usageEvent.aggregate({ where: { subject: v.subject, createdAt: { gte: periodStart(v.plan) } }, _sum: { units: true } })
    )._sum.units ?? 0;
    if (used + units > plan.aiActions) {
      const msg =
        v.plan === "ANON"
          ? `You've used today's ${plan.aiActions} free guest generations. Sign in for ${PLANS.FREE.aiActions}/month free.`
          : v.plan === "FREE"
            ? `You've used all ${plan.aiActions} AI generations this month. Upgrade to Pro for ${PLANS.PRO.aiActions}/month.`
            : "Monthly AI limit reached. Contact support to raise it.";
      return { ok: false, status: 402, error: msg, code: "quota" };
    }
  }
  return { ok: true };
}

export async function record(v: Viewer, mode: string, units: number, tokens?: number) {
  const prisma = db();
  if (!prisma) return;
  try {
    await prisma.usageEvent.create({ data: { subject: v.subject, userId: v.userId, mode, units, tokens: tokens ?? null } });
  } catch (e) {
    console.error("[metering] record failed", e);
  }
}
