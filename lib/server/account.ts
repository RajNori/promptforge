import "server-only";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { db } from "./db";
import { PLANS, type PlanId } from "@/lib/plans";

export type Viewer = {
  /** Metering key: user id, or a salted hash of the IP for guests. */
  subject: string;
  userId: string | null;
  plan: PlanId;
  email: string | null;
  name: string | null;
  image: string | null;
};

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

function hashIp(ip: string) {
  // Never store raw IPs.
  return "ip:" + createHash("sha256").update(`${process.env.AUTH_SECRET ?? "pf"}:${ip}`).digest("hex").slice(0, 32);
}

export async function getViewer(req: Request): Promise<Viewer> {
  const prisma = db();
  if (prisma && process.env.AUTH_SECRET) {
    try {
      const session = await auth();
      const id = session?.user?.id;
      if (id) {
        const u = await prisma.user.findUnique({ where: { id }, select: { id: true, plan: true, email: true, name: true, image: true } });
        if (u) {
          const isAdmin = !!u.email && adminEmails().includes(u.email.toLowerCase());
          return { subject: `u:${u.id}`, userId: u.id, plan: isAdmin ? "PRO" : u.plan, email: u.email, name: u.name, image: u.image };
        }
      }
    } catch (e) {
      console.error("[account] session lookup failed", e);
    }
  }
  return { subject: hashIp(clientIp(req)), userId: null, plan: "ANON", email: null, name: null, image: null };
}

export function periodStart(plan: PlanId, now = new Date()): Date {
  if (PLANS[plan].period === "day") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function usageSummary(v: Viewer) {
  const prisma = db();
  const limit = PLANS[v.plan].aiActions;
  if (!prisma) return { used: 0, limit, resetsAt: null as string | null, metered: false };
  const since = periodStart(v.plan);
  const agg = await prisma.usageEvent.aggregate({ where: { subject: v.subject, createdAt: { gte: since } }, _sum: { units: true } });
  const now = new Date();
  const resetsAt = PLANS[v.plan].period === "day" ? null : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { used: agg._sum.units ?? 0, limit, resetsAt, metered: true };
}
