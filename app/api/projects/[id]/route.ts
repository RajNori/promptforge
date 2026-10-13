import { z } from "zod";
import { BriefBlob, json, requireUser, titleOf } from "@/lib/server/projects";
import { sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function own(req: Request, id: string) {
  const u = await requireUser(req);
  if ("error" in u) return u;
  const p = await u.prisma.project.findFirst({ where: { id, userId: u.userId }, select: { id: true } });
  if (!p) return { error: json(404, { error: "Not found." }) } as const;
  return u;
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const u = await own(req, id);
  if ("error" in u) return u.error;
  const p = await u.prisma.project.findUnique({
    where: { id },
    select: { id: true, title: true, brief: true, updatedAt: true, versions: { orderBy: { seq: "asc" }, select: { id: true, seq: true, label: true, text: true, missing: true, pinned: true, createdAt: true } } },
  });
  return json(200, p);
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { id } = await params;
  const u = await own(req, id);
  if ("error" in u) return u.error;
  const body = z.object({ title: z.unknown().optional(), brief: BriefBlob.optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "Invalid request." });
  await u.prisma.project.update({
    where: { id },
    data: { ...(body.data.title !== undefined ? { title: titleOf(body.data.title) } : {}), ...(body.data.brief ? { brief: body.data.brief as object } : {}) },
  });
  return json(200, { ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { id } = await params;
  const u = await own(req, id);
  if ("error" in u) return u.error;
  await u.prisma.project.delete({ where: { id } });
  return json(200, { ok: true });
}
