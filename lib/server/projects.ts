import "server-only";
import { z } from "zod";
import { db } from "./db";
import { getViewer } from "./account";
import { LIMITS, cleanText } from "@/lib/sanitize";
import { MAX_UNPINNED_VERSIONS, PLANS } from "@/lib/plans";

export const json = (status: number, data: unknown) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Signed-in user + db, or an error response. */
export async function requireUser(req: Request) {
  const prisma = db();
  if (!prisma) return { error: json(503, { error: "Sync is not available." }) } as const;
  const v = await getViewer(req);
  if (!v.userId) return { error: json(401, { error: "Sign in to save prompts." }) } as const;
  return { prisma, v, userId: v.userId } as const;
}

export const BriefBlob = z.record(z.string(), z.unknown()).refine((o) => JSON.stringify(o).length < 60_000, "Brief too large");
export const titleOf = (t: unknown) => cleanText(t, 120).replace(/\s+/g, " ").trim() || "Untitled prompt";

export const VersionInput = z.object({
  label: z.preprocess((v) => cleanText(v, 80), z.string()),
  text: z.preprocess((v) => cleanText(v, LIMITS.prompt), z.string().min(1)),
  missing: z.array(z.preprocess((v) => cleanText(v, 60), z.string())).max(12).catch([]),
  /** Replace this version's content instead of adding (auto-fixes). */
  replaceId: z.string().max(40).optional(),
});

export const projectCap = (plan: keyof typeof PLANS) => PLANS[plan].projects;

/** Keep all pinned versions plus the newest N unpinned. */
export async function pruneVersions(prisma: NonNullable<ReturnType<typeof db>>, projectId: string) {
  const unpinned = await prisma.version.findMany({ where: { projectId, pinned: false }, orderBy: { seq: "desc" }, select: { id: true } });
  const drop = unpinned.slice(MAX_UNPINNED_VERSIONS).map((v) => v.id);
  if (drop.length) await prisma.version.deleteMany({ where: { id: { in: drop } } });
}
