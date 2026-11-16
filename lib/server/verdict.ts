/**
 * The model check behind every prompt-producing path (and scripts/gibberish-check.mts, so the check script
 * tests exactly what production runs). No framework imports: it runs from a plain tsx script too.
 */
import { TEXT_FIELDS, VERDICT_SYSTEM } from "../objective";

export type Verdict = { task: boolean; junk: string[] };
export type VerdictConfig = { url: string; key: string; model: string; extra: Record<string, unknown> };

// Verdicts per brief, per instance: retries and the analyze -> generate pair don't pay twice.
const verdicts = new Map<string, Verdict>();

/**
 * One small call: is the objective a task, and which of the listed fields are junk. null = no verdict
 * (provider error or unreadable answer), logged so a silent failure shows up in the logs.
 */
export async function briefVerdict(
  brief: { objective: string } & Partial<Record<(typeof TEXT_FIELDS)[number], string>>,
  fields: readonly string[],
  c: VerdictConfig,
): Promise<Verdict | null> {
  const input: Record<string, string> = { objective: brief.objective.trim().slice(0, 300) };
  for (const f of fields) input[f] = String(brief[f as (typeof TEXT_FIELDS)[number]] ?? "").trim().slice(0, 300);
  const k = JSON.stringify(input).toLowerCase();
  if (verdicts.has(k)) return verdicts.get(k)!;
  const ask = (jsonMode: boolean) =>
    fetch(`${c.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...c.extra,
        model: c.model,
        temperature: 0,
        // Reasoning models spend hidden tokens before the answer; 200 left nothing for it.
        max_tokens: 2000,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: VERDICT_SYSTEM },
          { role: "user", content: `FORM: ${JSON.stringify(input)}` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  try {
    let r = await ask(true);
    // Some models reject response_format: retry once without it, as the main call does.
    if (r.status === 400 || r.status === 422) r = await ask(false);
    if (!r.ok) {
      console.error("[verdict] upstream error", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const d = await r.json().catch(() => null);
    const raw: string = d?.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/"task"\s*:\s*(true|false)/);
    if (!m) {
      console.error("[verdict] unreadable answer", { finish: d?.choices?.[0]?.finish_reason, len: raw.length, head: raw.slice(0, 120) });
      return null;
    }
    const j = raw.match(/"junk"\s*:\s*\[([^\]]*)\]/);
    const named = j ? [...j[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1]) : [];
    const v: Verdict = { task: m[1] === "true", junk: named.filter((f) => fields.includes(f)) };
    if (verdicts.size > 2000) verdicts.clear();
    verdicts.set(k, v);
    return v;
  } catch (e) {
    console.error("[verdict] request failed", e instanceof Error ? e.message : e);
    return null;
  }
}
