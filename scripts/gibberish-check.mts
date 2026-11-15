// Real-model check for objective validation (16 Nov 2026). For every string below it reports:
//   pre    : the browser/server pattern check (blocks obvious mash with no model call)
//   verdict: DeepSeek's yes/no task verdict (VERDICT_SYSTEM), asked only when the pre-check can't decide
//   final  : blocked or allowed, which is what every path (Ask, Skip questions, Autofill, Quick draft) now does
// Exits 1 if any mash string is allowed or any real objective is blocked.
//   ENV_FILE=~/path/to/.env npx tsx scripts/gibberish-check.mts   (needs AI_BASE_URL, AI_API_KEY, AI_MODEL; ~20 tiny calls)
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

const extra = env.AI_FAST_BODY ? JSON.parse(env.AI_FAST_BODY) : env.AI_EXTRA_BODY ? JSON.parse(env.AI_EXTRA_BODY) : {};

// Every string Raj has typed, plus common mash shapes.
const MASH = [
  "sualskdlasjfljsdlkfjslfjslkfls", "dfgadgargafsgad", "aklsdjalksd alksdj", "asdasdasd", "qwerty uiop", "blah blah blah",
  "gadfgadfg", "fgafgadga sdgadg", "hasgdhasgd", "sdfkjhsdf lkjhlkj", "jfjfjfjfjf", "hdhdhd hdhdh", "lorem ipsum dolor",
  "xcvxcv bnmbnm", "ghfjdk", "adsfadsf", "werwer", "kjashd kjahsd", "poiupoiu", "zzzzzz",
];
// Terse real objectives with no common word: these used to be the false-positive risk.
const REAL = [
  "Kubernetes autoscaling", "GDPR checklist", "Kafka consumer lag", "Szczecin itinerary", "Wedding speech", "xkcd style comic",
  "Grpc vs REST", "Fjord cruise itinerary", "Rijksmuseum tickets", "Pnpm monorepo", "Wkhtmltopdf alternatives", "Quarterly OKRs",
  "Bewerbungsschreiben Softwareentwickler", "Rezept Lasagne vegetarisch", "Resumen ejecutivo informe", "Hvac quote comparison",
  "Djokovic biography", "Pitch deck outline", "Liberty bell history", "Instagram captions",
];

async function verdict(text: string): Promise<boolean | null> {
  const r = await fetch(`${env.AI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...extra, model: env.AI_MODEL, temperature: 0, max_tokens: 200, response_format: { type: "json_object" },
      messages: [{ role: "system", content: o.VERDICT_SYSTEM }, { role: "user", content: `TEXT: ${JSON.stringify(text)}` }],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const raw: string = (await r.json())?.choices?.[0]?.message?.content ?? "";
  const m = raw.match(/"task"\s*:\s*(true|false)/);
  return m ? m[1] === "true" : null;
}

let wrong = 0;
for (const [label, list, wantBlocked] of [["MASH", MASH, true], ["REAL", REAL, false]] as const) {
  console.log(`\n${label}`);
  for (const s of list) {
    const pre = o.isGibberishObjective(s);
    const ask = !pre && o.needsVerdict(s);
    const v = ask ? await verdict(s) : null;
    const blocked = pre || v === false;
    const ok = blocked === wantBlocked;
    if (!ok) wrong++;
    console.log(`${ok ? "ok  " : "FAIL"} ${blocked ? "blocked" : "allowed"}  pre=${pre ? "block" : "pass "} verdict=${ask ? v : "-"}  ${s}`);
  }
}
console.log(`\n${wrong ? `${wrong} wrong` : "all correct"} (${MASH.length} mash, ${REAL.length} real)`);
process.exit(wrong ? 1 : 0);
