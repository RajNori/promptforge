import { json, pruneVersions, requireUser, VersionInput } from "@/lib/server/projects";
import { sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Add a version (or replace one, for auto-fixes), then prune to the cap. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { id } = await params;
  const u = await requireUser(req);
  if ("error" in u) return u.error;
  const project = await u.prisma.project.findFirst({ where: { id, userId: u.userId }, select: { id: true } });
  if (!project) return json(404, { error: "Not found." });
  const body = VersionInput.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "Invalid request." });
  const { label, text, missing, replaceId } = body.data;

  const sel = { id: true, seq: true, label: true, text: true, missing: true, pinned: true, createdAt: true } as const;
  let version;
  if (replaceId) {
    const existing = await u.prisma.version.findFirst({ where: { id: replaceId, projectId: id }, select: { id: true } });
    if (!existing) return json(404, { error: "Version not found." });
    version = await u.prisma.version.update({ where: { id: replaceId }, data: { label, text, missing }, select: sel });
  } else {
    version = await u.prisma.$transaction(async (tx) => {
      const last = await tx.version.findFirst({ where: { projectId: id }, orderBy: { seq: "desc" }, select: { seq: true } });
      return tx.version.create({ data: { projectId: id, seq: (last?.seq ?? 0) + 1, label, text, missing }, select: sel });
    });
  }
  await u.prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
  await pruneVersions(u.prisma, id);
  return json(201, version);
}

/** Clear history: removes unpinned versions. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { id } = await params;
  const u = await requireUser(req);
  if ("error" in u) return u.error;
  const project = await u.prisma.project.findFirst({ where: { id, userId: u.userId }, select: { id: true } });
  if (!project) return json(404, { error: "Not found." });
  await u.prisma.version.deleteMany({ where: { projectId: id, pinned: false } });
  return json(200, { ok: true });
}
