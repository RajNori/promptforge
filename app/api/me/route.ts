import { authEnabled, enabledProviders } from "@/auth";
import { getViewer, usageSummary } from "@/lib/server/account";
import { hasDb } from "@/lib/server/db";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const v = await getViewer(req);
  const usage = await usageSummary(v).catch(() => ({ used: 0, limit: PLANS[v.plan].aiActions, resetsAt: null, metered: false }));
  return Response.json(
    {
      user: v.userId ? { name: v.name, email: v.email, image: v.image } : null,
      plan: v.plan,
      planName: PLANS[v.plan].name,
      period: PLANS[v.plan].period,
      usage,
      sync: Boolean(v.userId && hasDb()),
      auth: { enabled: authEnabled(), providers: enabledProviders() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
