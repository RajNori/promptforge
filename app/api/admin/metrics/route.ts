import { getViewer } from "@/lib/server/account";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAdmin = (email: string | null) =>
  !!email &&
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());

/**
 * Launch-gate metrics, admin only. GET /api/admin/metrics?days=30
 * - clickToBuy: distinct people who clicked Go Pro / distinct people who generated at least once.
 * - repeat: of people whose first generation was in the window, the share who generated again on a later UTC day.
 *   This is the proxy for repeat review until the review feature ships; switch the mode filter to "review" then.
 */
export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isAdmin(v.email)) return Response.json({ error: "Not found." }, { status: 404 });
  const prisma = db();
  if (!prisma) return Response.json({ error: "No database." }, { status: 503 });

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [row] = await prisma.$queryRaw<
    { active: bigint; clickers: bigint; clickers_active: bigint; cohort: bigint; returned: bigint; tokens: bigint | null }[]
  >`
    WITH gen AS (
      SELECT subject, date_trunc('day', "createdAt") AS d FROM "UsageEvent"
      WHERE mode IN ('generate', 'refine') AND "createdAt" >= ${since}
    ),
    firsts AS (
      SELECT subject, MIN(date_trunc('day', "createdAt")) AS first_day FROM "UsageEvent"
      WHERE mode IN ('generate', 'refine') GROUP BY subject
    ),
    cohort AS (SELECT subject, first_day FROM firsts WHERE first_day >= date_trunc('day', ${since}::timestamp)),
    intent AS (SELECT DISTINCT subject FROM "ProIntent" WHERE "createdAt" >= ${since})
    SELECT
      (SELECT COUNT(DISTINCT subject) FROM gen) AS active,
      (SELECT COUNT(*) FROM intent) AS clickers,
      (SELECT COUNT(*) FROM intent i WHERE EXISTS (SELECT 1 FROM gen g WHERE g.subject = i.subject)) AS clickers_active,
      (SELECT COUNT(*) FROM cohort) AS cohort,
      (SELECT COUNT(*) FROM cohort c WHERE EXISTS (SELECT 1 FROM gen g WHERE g.subject = c.subject AND g.d > c.first_day)) AS returned,
      (SELECT SUM(tokens) FROM "UsageEvent" WHERE "createdAt" >= ${since}) AS tokens
  `;
  const n = (x: bigint | null) => Number(x ?? 0);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const bySource = await prisma.proIntent.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { _all: true } });

  return Response.json(
    {
      days,
      activeGenerators: n(row.active),
      proClickers: n(row.clickers),
      clickToBuyPct: pct(n(row.clickers_active), n(row.active)),
      clickToBuyTarget: 5,
      newCohort: n(row.cohort),
      returnedOnLaterDay: n(row.returned),
      repeatPct: pct(n(row.returned), n(row.cohort)),
      repeatTarget: 30,
      intentBySource: Object.fromEntries(bySource.map((s) => [s.source, s._count._all])),
      tokens: n(row.tokens),
      note: "Guests are counted by hashed IP, so cross-device users count twice. Repeat uses generate/refine until review ships.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
