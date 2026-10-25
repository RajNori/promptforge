import { NextRequest } from "next/server";
import {
  ANALYZE_SYSTEM,
  briefToText,
  generateSystem,
  missingSections,
  refineSystem,
  requiredHeadings,
  targetGuidance,
  type Brief,
} from "@/lib/forge";
import { BodySchema, asBrief, makeCanary, sameOrigin, securityPreamble, suspicious, untrusted } from "@/lib/server/guard";
import { getViewer } from "@/lib/server/account";
import { precheck, record } from "@/lib/server/metering";
import { unitsFor } from "@/lib/plans";
import { cleanText } from "@/lib/sanitize";
import { SUGGEST_SYSTEM, applicableFields, hasSignal, isEmpty, suggestRequest, type SuggestField } from "@/lib/help";
import { persona as personaOf } from "@/lib/personas";

/** Task types where a coding-agent target makes sense. */
const ENGINEERING_TASKS = new Set(["Build a feature", "Fix a bug", "Refactor / migrate", "Architecture / design", "Code review / audit"]);

export const runtime = "nodejs";
export const maxDuration = 300;

// Provider is fully server-side and env-driven (any OpenAI-compatible chat completions endpoint).
// Nothing about the provider or model is ever sent to the browser.
const cfg = () => ({
  url: process.env.AI_BASE_URL?.replace(/\/+$/, "") ?? "",
  // Legacy key name kept as a fallback; prefer AI_API_KEY.
  key: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || "",
  model: process.env.AI_MODEL ?? "",
  // Optional provider-specific request params (e.g. reasoning controls), merged into every call. Server-side only.
  extra: parseExtra(process.env.AI_EXTRA_BODY),
  // Optional overrides for light tasks (analyze / suggest / refine), e.g. reasoning off. Merged over `extra`.
  fast: parseExtra(process.env.AI_FAST_BODY),
});

function parseExtra(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    console.error("[config] AI_EXTRA_BODY is not valid JSON; ignoring");
    return {};
  }
}

// End-of-stream marker: the client only accepts output that ends with it, so cut-off streams are never saved.
const EOT = "\u0004";
const configured = () => {
  const c = cfg();
  return Boolean(c.url && c.key && c.model);
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const GENERIC_FAIL = "Generation failed. Please try again.";
const sys = (canary: string, content: string) => `${securityPreamble(canary)}\n\n${content}`;

export async function GET() {
  return json(200, { configured: configured(), requiresAccessCode: Boolean(process.env.ACCESS_CODE) });
}

export async function POST(req: NextRequest) {
  if (!configured()) return json(503, { error: "AI generation isn't configured. Use Instant template mode." });
  if (!sameOrigin(req)) return json(403, { error: "Forbidden." });
  const { url, key, model, extra: baseExtra, fast } = cfg();

  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) return json(401, { error: "Invalid access code." });

  // Hard cap on body size before parsing (largest legit body is ~60KB).
  const raw = await req.text().catch(() => "");
  if (raw.length > 120_000) return json(413, { error: "Request too large." });
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const parsed = BodySchema.safeParse(parsedJson);
  if (!parsed.success) return json(400, { error: "Invalid request." });
  const body = parsed.data;
  const brief = asBrief(body.brief);
  if (!brief.objective.trim() && body.mode !== "refine" && body.mode !== "suggest") return json(400, { error: "Objective is required." });

  // Field suggestions resolve which fields to fill before metering.
  let suggestFields: SuggestField[] = [];
  if (body.mode === "suggest") {
    if (!hasSignal(brief)) return json(400, { error: "Add an objective or some context first." });
    const allowed = applicableFields(brief);
    const f = body.field as SuggestField | "all";
    suggestFields = f === "all" ? allowed.filter((x) => isEmpty(brief, x)) : allowed.includes(f) ? [f] : [];
    if (!suggestFields.length) return json(400, { error: f === "all" ? "Nothing to fill — all fields have values." : "Unknown field." });
  }
  if (body.mode === "refine" && (!body.prompt.trim() || !body.feedback.trim())) return json(400, { error: "Prompt and feedback are required." });

  // Identity, burst limit and quota.
  const viewer = await getViewer(req);
  const auto = body.mode === "refine" && body.auto;
  const units = auto ? 0 : unitsFor(body.mode, brief.chain);
  const check = await precheck(viewer, units, auto);
  if (!check.ok) return json(check.status, { error: check.error, code: check.code });

  const userText = [brief.objective, brief.context, body.mode === "refine" ? body.feedback : ""].join("\n");
  if (suspicious(userText)) console.warn("[guard] suspicious input", { subject: viewer.subject, mode: body.mode });

  const guidance = targetGuidance(brief.target);
  const extra = body.mode === "generate" ? baseExtra : { ...baseExtra, ...fast };
  const canary = makeCanary();

  let messages: { role: string; content: string }[];
  let stream = true;
  let temperature = 0.4;

  // Autofill context: who the user is, and whether the target fits the task.
  const persona = body.mode === "suggest" ? (viewer.profile?.persona ?? body.persona ?? null) : null;
  const engineering = ENGINEERING_TASKS.has(brief.taskType);
  const agentic = brief.target !== "chat-llm" && brief.target !== "api-system";
  const suggestGuidance = [
    persona ? `THE USER IS: ${personaOf(persona).label} (${personaOf(persona).blurb}). Write in their domain and vocabulary.` : "",
    agentic && !engineering
      ? `NOTE: this is a ${brief.taskType} task, not software work. Ignore the coding-agent target for field content — no repos, files, code, tests or PRs. Write values for the ${brief.taskType.toLowerCase()} task itself.`
      : guidance,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (body.mode === "suggest") {
    stream = false;
    temperature = 0.5;
    messages = [
      { role: "system", content: sys(canary, SUGGEST_SYSTEM) },
      { role: "user", content: `${suggestGuidance}\n\nCURRENT BRIEF:\n${untrusted("brief", briefToText(brief))}\n\n${suggestRequest(brief, suggestFields, persona)}` },
    ];
  } else if (body.mode === "analyze") {
    stream = false;
    temperature = 0.2;
    messages = [
      { role: "system", content: sys(canary, ANALYZE_SYSTEM) },
      { role: "user", content: `${guidance}\n\nBRIEF:\n${untrusted("brief", briefToText(brief))}` },
    ];
  } else if (body.mode === "generate") {
    messages = [
      { role: "system", content: sys(canary, generateSystem(brief)) },
      { role: "user", content: `${guidance}\n\nWrite the prompt for this brief:\n\n${untrusted("brief", briefToText(brief, body.clarifications))}` },
    ];
  } else {
    messages = [
      { role: "system", content: sys(canary, refineSystem(brief)) },
      {
        role: "user",
        content: `${guidance}\n\nORIGINAL BRIEF:\n${untrusted("brief", briefToText(brief))}\n\nCURRENT PROMPT:\n${untrusted("current_prompt", body.prompt)}\n\nFEEDBACK TO APPLY:\n${untrusted("feedback", body.feedback)}`,
      },
    ];
  }

  const call = (jsonMode: boolean) =>
    fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...extra,
        model,
        messages,
        stream,
        temperature,
        // Ceilings: reasoning models spend hidden tokens first, but providers reserve credit against max_tokens.
        max_tokens: body.mode === "suggest" ? 5000 : body.mode === "analyze" ? 4000 : brief.chain ? 10000 : 6000,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  let upstream: Response;
  try {
    const jsonOut = body.mode === "analyze" || body.mode === "suggest";
    upstream = await call(jsonOut);
    // Some models reject response_format — retry once without it (prompt already demands JSON).
    if (!upstream.ok && jsonOut && upstream.status === 400) upstream = await call(false);
  } catch (e) {
    console.error("[generate] upstream unreachable", e);
    return json(502, { error: GENERIC_FAIL });
  }

  if (!upstream.ok) {
    // Log the real error server-side only; never leak provider details to the client.
    console.error("[generate] upstream error", upstream.status, (await upstream.text().catch(() => "")).slice(0, 1000));
    if (upstream.status === 429) return json(429, { error: "The AI service is busy. Try again in a moment." });
    if (upstream.status === 402) return json(503, { error: "AI generation is temporarily unavailable." });
    return json(502, { error: GENERIC_FAIL });
  }

  // Charge only once the provider has accepted the call.
  const meterMode = auto ? "auto" : body.mode;

  if (!stream) {
    const data = await upstream.json().catch(() => null);
    await record(viewer, meterMode, units, data?.usage?.total_tokens);
    const rawOut: string = data?.choices?.[0]?.message?.content ?? "";
    if (rawOut.includes(canary)) {
      console.error("[guard] canary leak blocked", { subject: viewer.subject, mode: body.mode });
      return json(422, { error: "That request couldn't be processed." });
    }
    const cleaned = rawOut.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    if (body.mode === "suggest") {
      const values = parseSuggestions(cleaned, suggestFields);
      if (!Object.keys(values).length)
        console.error("[suggest] unparseable", { finish: data?.choices?.[0]?.finish_reason, len: rawOut.length });
      // Models occasionally drop keys in multi-field requests — one targeted follow-up for the gaps.
      const missing = suggestFields.filter((f) => !(f in values));
      if (missing.length) {
        const retry = await fetch(`${url}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...extra,
            model,
            temperature: 0.5,
            max_tokens: 5000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: sys(canary, SUGGEST_SYSTEM) },
              {
                role: "user",
                content: `${suggestGuidance}\n\nCURRENT BRIEF:\n${untrusted("brief", briefToText({ ...brief, ...values } as Brief))}\n\n${suggestRequest(brief, missing, persona)}`,
              },
            ],
          }),
        }).catch(() => null);
        if (retry?.ok) {
          const d2 = await retry.json().catch(() => null);
          const raw2: string = d2?.choices?.[0]?.message?.content ?? "";
          if (!raw2.includes(canary)) Object.assign(values, parseSuggestions(raw2.replace(/^```(?:json)?\s*|\s*```$/g, "").trim(), missing));
        }
      }
      if (!Object.keys(values).length) return json(502, { error: "No suggestion produced. Try again." });
      return json(200, { values });
    }
    try {
      const p = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      const q = (Array.isArray(p.questions) ? p.questions : [])
        .slice(0, 4)
        .map((x: { question?: unknown; why?: unknown }) => ({ question: cleanText(x?.question, 500), why: cleanText(x?.why, 300) }))
        .filter((x: { question: string }) => x.question);
      return json(200, {
        score: Math.max(0, Math.min(100, Number(p.score) || 0)),
        gaps: (Array.isArray(p.gaps) ? p.gaps : []).slice(0, 6).map((g: unknown) => cleanText(g, 300)).filter(Boolean),
        questions: q,
      });
    } catch {
      return json(200, { score: 50, gaps: [], questions: [] });
    }
  }

  // Re-stream upstream SSE as plain text chunks (content deltas only), validating the full output at the end.
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      let buf = "";
      let full = "";
      let finish: string | null = null;
      let failed = false;
      let tokens: number | undefined;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const payload = l.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.error) {
                console.error("[generate] stream error", evt.error);
                failed = true;
              }
              if (evt.usage) tokens = evt.usage.total_tokens;
              const choice = evt?.choices?.[0];
              const delta: string | undefined = choice?.delta?.content;
              if (delta) {
                full += delta;
                // Strip the canary if it arrives whole in one delta; split canaries are caught by the final check (output discarded).
                controller.enqueue(encoder.encode(delta.replaceAll(canary, "")));
              }
              if (choice?.finish_reason) finish = choice.finish_reason;
            } catch {
              /* keep-alive / partial */
            }
          }
        }
      } catch (e) {
        failed = true;
        console.error("[generate] stream read failed", e);
      } finally {
        await record(viewer, meterMode, units, tokens);
        let status: string | null = null;
        if (!failed && finish) {
          status = finish === "length" ? "len" : "ok";
          if (full.includes(canary)) {
            status = "blocked";
            console.error("[guard] canary leak blocked", { subject: viewer.subject, mode: body.mode });
          } else if (requiredHeadings(brief).length && missingSections(full, brief).length === requiredHeadings(brief).length && !brief.chain) {
            // Not a prompt at all (e.g. the model was steered into answering the task directly).
            status = "off";
            console.warn("[guard] off-task output", { subject: viewer.subject, mode: body.mode, len: full.length });
          }
        } else console.error("[generate] stream ended without clean finish", { finish, failed });
        if (status) controller.enqueue(encoder.encode(EOT + status));
        controller.close();
      }
    },
  });

  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

function parseSuggestions(text: string, fields: SuggestField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return values;
  }
  for (const f of fields) {
    const v = parsed[f];
    if (f === "rules" && Array.isArray(v)) {
      const rules = v
        .filter((x) => x && typeof x.rule === "string" && x.rule.trim())
        .slice(0, 6)
        .map((x) => ({ rule: String(x.rule).trim().slice(0, 300), why: typeof x.why === "string" ? lowerFirst(x.why.trim().replace(/^because\s+/i, "")).slice(0, 300) : "" }));
      if (rules.length) values.rules = rules;
    } else if (typeof v === "string" && v.trim()) {
      values[f] = v.trim().slice(0, 3000);
    } else if (Array.isArray(v) && (f === "successCriteria" || f === "outputFormat")) {
      values[f] = v.map(String).join("\n").slice(0, 3000);
    } else if (v && typeof v === "object" && f === "outputSchema") {
      values[f] = JSON.stringify(v);
    }
  }
  return values;
}

// "because Prevents…" → "because prevents…" (keep acronyms like "API" intact).
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
