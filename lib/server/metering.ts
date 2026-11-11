import "server-only";
import { db } from "./db";
import { periodStart, type Viewer } from "./account";
import { PLANS } from "@/lib/plans";

export type Reservation =
  | { ok: true; id: string | null }
  | { ok: false; status: number; error: string; code: "burst" | "quota" | "auto" | "budget" };

// In-memory fallback when no database is configured (per instance, best-effort).
const mem = new Map<string, number[]>();

/** Live hints fire as people type: their own budget, so they never block a real generation. */
const HINTS_PER_10M = 40;

/**
 * Site-wide daily token budget across every user and mode (spend cap). Soft cap: in-flight calls are
 * estimated, so it can overshoot by roughly (concurrent calls x IN_FLIGHT_ESTIMATE). Set the provider-side
 * key limit as the hard backstop. 0 disables it.
 */
const dailyTokenBudget = () => {
  const n = Number(process.env.AI_DAILY_TOKEN_BUDGET ?? 2_000_000);
  return Number.isFinite(n) && n >= 0 ? n : 2_000_000;
};
/** Tokens assumed for a reservation whose call hasn't settled yet. */
const IN_FLIGHT_ESTIMATE = 8_000;
/** Reservations older than this with no token count are treated as settled (crashed function). */
const IN_FLIGHT_WINDOW_MS = 6 * 60 * 1000;

const BUSY = "Too many requests. Try again in a few minutes.";

/**
 * Check burst limit, auto-repair allowance, plan quota and the global budget, and reserve the usage
 * in the same transaction, before the AI call starts.
 *
 * Previously usage was recorded only after the response finished streaming, so N parallel requests all
 * passed the check. Now a per-subject advisory lock serialises check-and-insert, so a concurrent request
 * sees every earlier reservation. Call `settle` with the token count when done, or `release` if the
 * provider never accepted the call.
 */
export async function reserve(v: Viewer, mode: string, units: number, auto: boolean): Promise<Reservation> {
  const plan = PLANS[v.plan];
  const hints = mode === "hints";
  const limit = hints ? HINTS_PER_10M : plan.burstPer10m;
  const prisma = db();

  if (!prisma) {
    // Synchronous read-modify-write, so it is race-free within one instance.
    const now = Date.now();
    const memKey = hints ? `${v.subject}:hints` : v.subject;
    const arr = (mem.get(memKey) ?? []).filter((t) => now - t < 600_000);
    if (arr.length >= limit) return { ok: false, status: 429, error: BUSY, code: "burst" };
    arr.push(now);
    mem.set(memKey, arr);
    return { ok: true, id: null };
  }

  const meterMode = auto ? "auto" : mode;
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    // Serialise all reservations for this subject. Released automatically at commit/rollback.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${v.subject}))`;

    const recent = await tx.usageEvent.groupBy({
      by: ["mode"],
      where: { subject: v.subject, createdAt: { gte: tenMinAgo } },
      _count: { _all: true },
    });
    const calls = recent.filter((r) => (r.mode === "hints") === hints).reduce((n, r) => n + r._count._all, 0);
    if (calls >= limit) return { ok: false, status: 429, error: BUSY, code: "burst" } as const;

    if (auto) {
      // Free auto-repairs are only allowed in proportion to paid calls — stops clients flagging everything as "auto".
      const autos = recent.find((r) => r.mode === "auto")?._count._all ?? 0;
      const paid = recent.filter((r) => r.mode === "generate" || r.mode === "refine").reduce((n, r) => n + r._count._all, 0);
      if (autos >= paid * 2) return { ok: false, status: 429, error: "Auto-fix limit reached. Refine manually.", code: "auto" } as const;
    } else if (units > 0) {
      const used =
        (await tx.usageEvent.aggregate({ where: { subject: v.subject, createdAt: { gte: periodStart(v.plan) } }, _sum: { units: true } }))._sum
          .units ?? 0;
      if (used + units > plan.aiActions) {
        const msg =
          v.plan === "ANON"
            ? `You've used today's ${plan.aiActions} free guest generations. Sign in for ${PLANS.FREE.aiActions}/month free.`
            : v.plan === "FREE"
              ? `You've used all ${plan.aiActions} AI generations this month. Upgrade to Pro for ${PLANS.PRO.aiActions}/month.`
              : "Monthly AI limit reached. Contact support to raise it.";
        return { ok: false, status: 402, error: msg, code: "quota" } as const;
      }
    }

    const budget = dailyTokenBudget();
    if (budget > 0) {
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const [spent, inFlight] = await Promise.all([
        tx.usageEvent.aggregate({ where: { createdAt: { gte: dayStart } }, _sum: { tokens: true } }),
        tx.usageEvent.count({ where: { tokens: null, createdAt: { gte: new Date(now.getTime() - IN_FLIGHT_WINDOW_MS) } } }),
      ]);
      if ((spent._sum.tokens ?? 0) + inFlight * IN_FLIGHT_ESTIMATE >= budget) {
        console.error("[metering] daily token budget reached", { budget, spent: spent._sum.tokens, inFlight });
        return { ok: false, status: 503, error: "AI generation is paused for today. Instant templates still work.", code: "budget" } as const;
      }
    }

    const row = await tx.usageEvent.create({ data: { subject: v.subject, userId: v.userId, mode: meterMode, units }, select: { id: true } });
    return { ok: true, id: row.id } as const;
  });
}

/** Record the token count on a reservation once the call has finished. */
export async function settle(id: string | null, tokens: number) {
  const prisma = db();
  if (!prisma || !id) return;
  try {
    await prisma.usageEvent.update({ where: { id }, data: { tokens: Math.max(0, Math.round(tokens)) } });
  } catch (e) {
    console.error("[metering] settle failed", e);
  }
}

/** Refund a reservation when the provider never accepted the call (unreachable / non-2xx). */
export async function release(id: string | null) {
  const prisma = db();
  if (!prisma || !id) return;
  try {
    await prisma.usageEvent.delete({ where: { id } });
  } catch (e) {
    console.error("[metering] release failed", e);
  }
}

/** Rough token estimate when the provider doesn't report usage (≈4 chars per token). */
export const estimateTokens = (...texts: string[]) => Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4);
