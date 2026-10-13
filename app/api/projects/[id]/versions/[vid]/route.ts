import { z } from "zod";
import { json, pruneVersions, requireUser } from "@/lib/server/projects";
import { sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string; vid: string }> };

/** Pin / unpin. Unpinning re-applies the cap. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { id, vid } = await params;
  const u = await requireUser(req);
  if ("error" in u) return u.error;
  const v = await u.prisma.version.findFirst({ where: { id: vid, projectId: id, project: { userId: u.userId } }, select: { id: true } });
  if (!v) return json(404, { error: "Not found." });
  const body = z.object({ pinned: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "Invalid request." });
  if (body.data.pinned) {
    const pinnedCount = await u.prisma.version.count({ where: { projectId: id, pinned: true } });
    if (pinnedCount >= 10) return json(400, { error: "Up to 10 pinned versions per prompt." });
  }
  await u.prisma.version.update({ where: { id: vid }, data: { pinned: body.data.pinned } });
  if (!body.data.pinned) await pruneVersions(u.prisma, id);
  return json(200, { ok: true });
}
