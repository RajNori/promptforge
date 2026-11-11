import { z } from "zod";
import { getViewer } from "@/lib/server/account";
import { db } from "@/lib/server/db";
import { sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";

const Body = z.object({ source: z.enum(["pricing", "menu", "quota"]).catch("pricing") });

/** Records a "Go Pro" click while payments aren't live. Feeds the click-to-buy metric. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Forbidden." }, { status: 403 });
  const { source } = Body.parse(await req.json().catch(() => ({})));
  const v = await getViewer(req);
  const prisma = db();
  if (prisma) {
    try {
      // One row per subject per source per hour is enough signal and stops a click loop inflating the metric.
      const recent = await prisma.proIntent.findFirst({
        where: { subject: v.subject, source, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
        select: { id: true },
      });
      if (!recent) await prisma.proIntent.create({ data: { subject: v.subject, userId: v.userId, source } });
    } catch (e) {
      console.error("[intent] record failed", e);
    }
  }
  return Response.json({ ok: true, signedIn: Boolean(v.userId), email: v.email }, { headers: { "cache-control": "no-store" } });
}
