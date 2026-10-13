import { requireUser, json } from "@/lib/server/projects";
import { sameOrigin } from "@/lib/server/guard";
import { ProfileSchema } from "@/lib/profile";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden" });
  const ctx = await requireUser(req);
  if ("error" in ctx) return ctx.error;
  const raw = await req.text();
  if (raw.length > 4_000) return json(413, { error: "Too large" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const p = ProfileSchema.safeParse(body);
  if (!p.success) return json(400, { error: "Invalid profile" });
  await ctx.prisma.user.update({ where: { id: ctx.userId }, data: { profile: p.data } });
  return json(200, { profile: p.data });
}
