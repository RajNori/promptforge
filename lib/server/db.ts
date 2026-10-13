import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/** Direct Postgres URL. Vercel's Prisma Postgres integration injects DATABASE_URL (POSTGRES_URL as fallback). */
export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const hasDb = () => /^postgres(ql)?:\/\//.test(databaseUrl());

const g = globalThis as unknown as { __prisma?: PrismaClient };

/** Lazily created singleton; null when no database is configured (app degrades to anonymous, local-only mode). */
export function db(): PrismaClient | null {
  if (!hasDb()) return null;
  if (!g.__prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl(), max: 5, idleTimeoutMillis: 10_000 });
    g.__prisma = new PrismaClient({ adapter });
  }
  return g.__prisma;
}
