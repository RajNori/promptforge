import { defineConfig } from "prisma/config";

// DATABASE_URL is injected by the Vercel Prisma Postgres integration (or .env.local in dev).
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
