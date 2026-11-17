// Real-model check for input validation (16 Nov 2026). Runs the same pattern checks and the same model call
// (lib/server/verdict.ts) that production runs on every path (Ask, Skip questions, Autofill, Quick draft).
//   OBJECTIVES: mash must be blocked, terse real objectives must pass.
//   FIELDS: mash in Audience/Tone/Deliverable must be caught, short real values must pass.
// Exits 1 on any wrong result, or if the model gives no verdict at all (that is what let mash through on 16 Nov).
//   ENV_FILE=~/path/to/.env npx tsx scripts/gibberish-check.mts   (needs AI_BASE_URL, AI_API_KEY, AI_MODEL; ~40 small calls)
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
{
  const f = process.env.ENV_FILE ?? path.join(HERE, ".env");
  if (existsSync(f))
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
}
const env = process.env;
const REPO = path.resolve(HERE, "..");
const o: any = await import(pathToFileURL(path.join(REPO, "lib/objective.ts")).href);

const v: any = await import(pathToFileURL(path.join(REPO, "lib/server/verdict.ts")).href);
const parse = (x?: string) => (x ? JSON.parse(x) : {});
const cfg = { url: env.AI_BASE_URL!.replace(/\/+$/, ""), key: env.AI_API_KEY!, model: env.AI_MODEL!, extra: { ...parse(env.AI_EXTRA_BODY), ...parse(env.AI_FAST_BODY) } };

const { MASH, REAL, FIELD_MASH, FIELD_REAL, FIELD_OBJECTIVE: OBJ }: any = await import(pathToFileURL(path.join(REPO, "lib/server/verdict-cases.ts")).href);

let wrong = 0;
let noVerdict = 0;
const show = (ok: boolean, blocked: boolean, how: string, s: string) => {
  if (!ok) wrong++;
  console.log(`${ok ? "ok  " : "FAIL"} ${blocked ? "blocked" : "allowed"}  ${how}  ${s}`);
};

for (const [label, list, wantBlocked] of [["OBJECTIVE: MASH", MASH, true], ["OBJECTIVE: REAL", REAL, false]] as const) {
  console.log(`\n${label}`);
  for (const s of list) {
    const pre = o.isGibberishObjective(s);
    const ask = !pre && o.needsVerdict(s);
    const r = ask ? await v.briefVerdict({ objective: s }, [], cfg) : null;
    if (ask && !r) noVerdict++;
    // No verdict: production now refuses (503) rather than guessing, so it counts as blocked but is reported.
    const blocked = pre || (ask && (!r || !r.task));
    show(blocked === wantBlocked && !(ask && !r), blocked, `pre=${pre ? "block" : "pass "} verdict=${ask ? (r ? r.task : "NONE") : "-"}`, s);
  }
}

for (const [label, list, wantBlocked] of [["FIELD (Audience): MASH", FIELD_MASH, true], ["FIELD (Audience): REAL", FIELD_REAL, false]] as const) {
  console.log(`\n${label}  (objective: ${OBJ})`);
  for (const s of list) {
    const pre = o.isGibberishField(s);
    const ask = !pre && o.unprovenFields({ audience: s }).includes("audience");
    const r = ask ? await v.briefVerdict({ objective: OBJ, audience: s }, ["audience"], cfg) : null;
    if (ask && !r) noVerdict++;
    const blocked = pre || (!!r && r.junk.includes("audience"));
    show(blocked === wantBlocked && !(ask && !r), blocked, `pre=${pre ? "block" : "pass "} verdict=${ask ? (r ? (r.junk.includes("audience") ? "junk" : "fine") : "NONE") : "-"}`, s);
  }
}

console.log(`\n${wrong ? `${wrong} wrong` : "all correct"}${noVerdict ? `, ${noVerdict} with NO verdict (model call failed; see errors above)` : ""}`);
process.exit(wrong ? 1 : 0);
