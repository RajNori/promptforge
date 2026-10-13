import { z } from "zod";
import { BriefBlob, json, projectCap, requireUser, titleOf } from "@/lib/server/projects";
import { sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = await requireUser(req);
  if ("error" in u) return u.error;
  const projects = await u.prisma.project.findMany({
    where: { userId: u.userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, updatedAt: true, _count: { select: { versions: true } } },
  });
  return json(200, { projects: projects.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt, versions: p._count.versions })) });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const u = await requireUser(req);
  if ("error" in u) return u.error;
  const body = z.object({ title: z.unknown().optional(), brief: BriefBlob }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "Invalid request." });
  const count = await u.prisma.project.count({ where: { userId: u.userId } });
  if (count >= projectCap(u.v.plan)) return json(402, { error: `Your plan allows ${projectCap(u.v.plan)} saved prompts. Delete one or upgrade.`, code: "quota" });
  const p = await u.prisma.project.create({
    data: { userId: u.userId, title: titleOf(body.data.title ?? body.data.brief.objective), brief: body.data.brief as object },
    select: { id: true, title: true },
  });
  return json(201, p);
}
