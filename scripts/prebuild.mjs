// Build-time DB setup: generate the client always; run migrations only when a database is configured.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma generate");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
if (/^postgres(ql)?:\/\//.test(url)) {
  console.log("[prebuild] Database configured — applying migrations");
  run("npx prisma migrate deploy");
} else {
  console.log("[prebuild] No DATABASE_URL — skipping migrations (app runs in local-only mode)");
}
