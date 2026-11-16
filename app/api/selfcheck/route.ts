import { isGibberishField, isGibberishObjective, needsVerdict, unprovenFields } from "@/lib/objective";
import { briefVerdict } from "@/lib/server/verdict";
import { FIELD_MASH, FIELD_OBJECTIVE, FIELD_REAL, MASH, REAL } from "@/lib/server/verdict-cases";

/**
 * Preview deployments only: runs the gibberish cases through the real model with the deployment's own settings,
 * so a change can be checked against the real provider before it is merged. 404 everywhere else.
 */
export const maxDuration = 60;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return new Response("Not found", { status: 404 });
  const cfg = {
    url: (process.env.AI_BASE_URL ?? "").replace(/\/+$/, ""),
    key: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "",
    extra: { ...parse(process.env.AI_EXTRA_BODY), ...parse(process.env.AI_FAST_BODY) },
  };
  if (!cfg.url || !cfg.key) return Response.json({ error: "AI not configured on this deployment" }, { status: 503 });
  const objective = async (s: string, wantBlocked: boolean) => {
    const pre = isGibberishObjective(s);
    const ask = !pre && needsVerdict(s);
    const v = ask ? await briefVerdict({ objective: s }, [], cfg) : null;
    const blocked = pre || (ask && (!v || !v.task));
    return { s, pre, verdict: ask ? (v ? v.task : "NONE") : "-", blocked, ok: blocked === wantBlocked && !(ask && !v) };
  };
  const field = async (s: string, wantBlocked: boolean) => {
    const pre = isGibberishField(s);
    const ask = !pre && unprovenFields({ audience: s }).includes("audience");
    const v = ask ? await briefVerdict({ objective: FIELD_OBJECTIVE, audience: s }, ["audience"], cfg) : null;
    const blocked = pre || (!!v && v.junk.includes("audience"));
    return { s, pre, verdict: ask ? (v ? (v.junk.includes("audience") ? "junk" : "fine") : "NONE") : "-", blocked, ok: blocked === wantBlocked && !(ask && !v) };
  };
  const rows = await Promise.all([
    ...MASH.map((s) => objective(s, true).then((r) => ({ kind: "objective mash", ...r }))),
    ...REAL.map((s) => objective(s, false).then((r) => ({ kind: "objective real", ...r }))),
    ...FIELD_MASH.map((s) => field(s, true).then((r) => ({ kind: "field mash", ...r }))),
    ...FIELD_REAL.map((s) => field(s, false).then((r) => ({ kind: "field real", ...r }))),
  ]);
  const wrong = rows.filter((r) => !r.ok);
  return Response.json({ model: cfg.model, total: rows.length, wrong: wrong.length, failures: wrong, rows }, { headers: { "cache-control": "no-store" } });
}

function parse(x?: string): Record<string, unknown> {
  try {
    return x ? JSON.parse(x) : {};
  } catch {
    return {};
  }
}
