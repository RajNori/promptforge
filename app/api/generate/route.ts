import { NextRequest } from "next/server";
import {
  ANALYZE_SYSTEM,
  briefToText,
  generateSystem,
  missingSections,
  refineSystem,
  requiredHeadings,
  targetGuidance,
  normalizeBrief,
  compileTemplate,
  isEngineering,
  EMPTY_BRIEF,
  type Brief,
} from "@/lib/forge";
import { BodySchema, asBrief, makeCanary, sameOrigin, securityPreamble, suspicious, untrusted } from "@/lib/server/guard";
import { getViewer } from "@/lib/server/account";
import { estimateTokens, refund, release, reserve, settle } from "@/lib/server/metering";
import { OBJECTIVE_EXAMPLE, UNCLEAR_MARKER, UNCLEAR_OBJECTIVE_MSG, isGibberishObjective, needsVerdict, unprovenFields, UNCLEAR_FIELD_MSG, withoutGibberish } from "@/lib/objective";
import { briefVerdict } from "@/lib/server/verdict";
import { unitsFor } from "@/lib/plans";
import { LIMITS, cleanText } from "@/lib/sanitize";
import { HINTS_SYSTEM, HINT_FIELDS, SUGGEST_SYSTEM, applicableFields, hasSignal, hintsRequest, isEmpty, suggestRequest, type SuggestField } from "@/lib/help";
import { persona as personaOf } from "@/lib/personas";

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

/** No prompt for an objective with no discernible task: the client shows this inline on the objective field. */
const unclear = () => json(422, { error: UNCLEAR_OBJECTIVE_MSG, example: OBJECTIVE_EXAMPLE, code: "unclear_objective" });

const GENERIC_FAIL = "Generation failed. Please try again.";
const sys = (canary: string, content: string) => `${securityPreamble(canary)}\n\n${content}`;

export async function GET() {
  return json(200, { configured: configured(), requiresAccessCode: Boolean(process.env.ACCESS_CODE) });
}

export async function POST(req: NextRequest) {
  // Quick draft needs no AI, but still goes through every check below; everything else needs the provider.
  const aiOn = configured();
  const peek = req.clone();
  const isTemplate = await peek.json().then((b) => b?.mode === "template").catch(() => false);
  if (!aiOn && !isTemplate) return json(503, { error: "AI generation isn't configured. Use Instant template mode.", code: "not_configured" });
  if (!sameOrigin(req)) return json(403, { error: "Forbidden.", code: "forbidden" });
  const { url, key, model, extra: baseExtra, fast } = cfg();

  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) return json(401, { error: "Invalid access code.", code: "access_code" });

  // Hard cap on body size before parsing (largest legit body is ~60KB).
  const raw = await req.text().catch(() => "");
  if (raw.length > 120_000) return json(413, { error: "Request too large.", code: "too_large" });
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON", code: "bad_request" });
  }
  const parsed = BodySchema.safeParse(parsedJson);
  if (!parsed.success) return json(400, { error: "Invalid request.", code: "bad_request" });
  const body = parsed.data;
  // Identity first: the user's role decides what kind of job this is, for every stage below.
  const viewer = await getViewer(req);
  const persona = viewer.profile?.persona ?? body.persona ?? null;
  // Optional fields that are keyboard mash are left out, so they never reach the model (the form already nudged the person).
  let brief = withoutGibberish(normalizeBrief(asBrief(body.brief), persona));
  if (!brief.objective.trim() && body.mode !== "refine" && body.mode !== "suggest") return json(400, { error: "Objective is required.", code: "objective_required" });
  if (body.mode === "hints" && brief.objective.trim().split(/\s+/).length < 2) return json(400, { error: "Objective too short for hints.", code: "objective_short" });
  // Obvious keyboard mash never reaches the model or the quota (same loose check the browser runs first).
  // Suggest is included: filling fields from keyboard mash only spreads it through the brief.
  if (body.mode !== "refine" && isGibberishObjective(brief.objective)) return unclear();

  // One choke point for every path that builds from the brief: the model judges an unproven objective and any
  // optional field the pattern check can't vouch for. Simple mode stops on a junk field; Advanced leaves it out.
  const strict = "strict" in body && body.strict === true;
  let leftOut: string[] = [];
  const judged = body.mode === "template" || body.mode === "analyze" || body.mode === "generate" || body.mode === "suggest";
  const needObj = judged && needsVerdict(brief.objective);
  // Autofill replaces the field it targets, so that one isn't judged.
  const fieldsToJudge = judged ? unprovenFields(brief).filter((f) => !(body.mode === "suggest" && (body.field === f || body.field === "all"))) : [];
  /** null = carry on; a Response = stop with it. */
  const gate = async (): Promise<Response | null> => {
    if (!aiOn || (!needObj && !fieldsToJudge.length)) return null;
    const v = await briefVerdict(brief, fieldsToJudge, { url, key, model, extra: { ...baseExtra, ...fast } });
    if (!v) {
      // Couldn't get a verdict. An unproven objective doesn't go through on a guess (that's how mash got in on 16 Nov).
      if (needObj) return json(503, { error: "AI generation is temporarily unavailable.", code: "unavailable" });
      return null;
    }
    if (needObj && !v.task) {
      console.warn("[guard] unclear objective (verdict)", { subject: viewer.subject, mode: body.mode });
      return unclear();
    }
    if (v.junk.length) {
      console.warn("[guard] junk fields (verdict)", { subject: viewer.subject, mode: body.mode, fields: v.junk });
      if (strict) return json(422, { error: UNCLEAR_FIELD_MSG, code: "unclear_fields", fields: v.junk });
      const b = { ...brief };
      for (const f of v.junk) (b as Record<string, unknown>)[f] = "";
      brief = b;
      leftOut = v.junk;
    }
    return null;
  };
  const tagLeftOut = (r: Response) => {
    if (leftOut.length) r.headers.set("x-left-out", leftOut.join(","));
    return r;
  };

  // Quick draft: no quota, but the same gate (a zero-unit reservation keeps the burst limit on the model check).
  if (body.mode === "template") {
    if (aiOn && (needObj || fieldsToJudge.length)) {
      const check = await reserve(viewer, "template", 0, false).catch(() => null);
      if (check && !check.ok) return json(check.status, { error: check.error, code: check.code });
      const stop = await gate();
      await settle(check?.ok ? check.id : null, 150);
      if (stop) return stop;
    }
    return tagLeftOut(json(200, { text: compileTemplate(brief, body.clarifications) }));
  }

  // Field suggestions resolve which fields to fill before metering.
  let suggestFields: SuggestField[] = [];
  if (body.mode === "suggest") {
    if (!hasSignal(brief)) return json(400, { error: "Add an objective or some context first.", code: "no_signal" });
    const allowed = applicableFields(brief, { audienceTone: body.audienceTone });
    const f = body.field as SuggestField | "all";
    suggestFields = f === "all" ? allowed.filter((x) => isEmpty(brief, x)) : allowed.includes(f) ? [f] : [];
    if (!suggestFields.length) return json(400, { error: f === "all" ? "Nothing to fill — all fields have values." : "Unknown field.", code: f === "all" ? "nothing_to_fill" : "bad_request" });
  }
  if (body.mode === "refine" && (!body.prompt.trim() || !body.feedback.trim())) return json(400, { error: "Prompt and feedback are required.", code: "refine_empty" });

  // Burst limit, quota and daily budget, reserved atomically before the call (refunded if the provider rejects it).
  const auto = body.mode === "refine" && body.auto;
  const units = auto ? 0 : unitsFor(body.mode, brief.chain);
  let check: Awaited<ReturnType<typeof reserve>>;
  try {
    check = await reserve(viewer, body.mode, units, auto);
  } catch (e) {
    // Fail closed: never call the provider without a reservation.
    console.error("[metering] reserve failed", e);
    return json(503, { error: "AI generation is temporarily unavailable.", code: "unavailable" });
  }
  if (!check.ok) return json(check.status, { error: check.error, code: check.code });
  const reservation = check.id;

  if (judged) {
    const stop = await gate();
    if (stop) {
      await refund(reservation, 0);
      return stop;
    }
  }

  const userText = [brief.objective, brief.context, body.mode === "refine" ? body.feedback : ""].join("\n");
  if (suspicious(userText)) console.warn("[guard] suspicious input", { subject: viewer.subject, mode: body.mode });

  const guidance = targetGuidance(brief.target);
  const extra = body.mode === "generate" ? baseExtra : { ...baseExtra, ...fast };
  // Hints cover every text field; the client shows the ones that are visible and empty.
  const hintFields = HINT_FIELDS;
  const canary = makeCanary();

  let messages: { role: string; content: string }[];
  let stream = true;
  let temperature = 0.4;

  // Same framing for every stage: who the user is, what kind of job, what the target is.
  const who = persona ? `THE USER IS: ${personaOf(persona).label} (${personaOf(persona).blurb}). Stay in their domain and vocabulary.` : "";
  const domain = isEngineering(brief.taskType)
    ? `KIND OF JOB: software (${brief.taskType}).`
    : `KIND OF JOB: ${brief.taskType} — not software. Nothing about code, files, repositories, tests or tooling.`;
  const framing = [who, domain, guidance].filter(Boolean).join("\n\n");

  if (body.mode === "hints") {
    stream = false;
    temperature = 0.6;
    messages = [
      { role: "system", content: sys(canary, HINTS_SYSTEM) },
      { role: "user", content: `${who}\n\n${untrusted("brief", hintsRequest(brief, hintFields))}` },
    ];
  } else if (body.mode === "suggest") {
    const improvingObjective = suggestFields.length === 1 && suggestFields[0] === "objective" && !!brief.objective.trim();
    stream = false;
    temperature = 0.5;
    messages = [
      { role: "system", content: sys(canary, SUGGEST_SYSTEM) },
      {
        role: "user",
        // Improving a typed objective: send only the objective. Leftover fields (e.g. from an earlier template)
        // must never pull the user's task toward a different topic.
        content: improvingObjective
          ? `${framing}\n\n${suggestRequest({ ...EMPTY_BRIEF, taskType: brief.taskType, target: brief.target, objective: brief.objective }, suggestFields, persona)}`
          : `${framing}\n\nCURRENT BRIEF:\n${untrusted("brief", briefToText(brief))}\n\n${suggestRequest(brief, suggestFields, persona)}`,
      },
    ];
  } else if (body.mode === "analyze") {
    stream = false;
    temperature = 0.2;
    messages = [
      { role: "system", content: sys(canary, ANALYZE_SYSTEM) },
      { role: "user", content: `${framing}\n\nBRIEF:\n${untrusted("brief", briefToText(brief))}` },
    ];
  } else if (body.mode === "generate") {
    messages = [
      { role: "system", content: sys(canary, generateSystem(brief)) },
      { role: "user", content: `${framing}\n\nWrite the prompt for this brief:\n\n${untrusted("brief", briefToText(brief, body.clarifications))}` },
    ];
  } else {
    messages = [
      { role: "system", content: sys(canary, refineSystem(brief)) },
      {
        role: "user",
        content: `${framing}\n\nORIGINAL BRIEF:\n${untrusted("brief", briefToText(brief))}\n\nCURRENT PROMPT:\n${untrusted("current_prompt", body.prompt)}\n\nFEEDBACK TO APPLY:\n${untrusted("feedback", body.feedback)}`,
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
        // Ask for token usage on streams too, so the daily budget sees real numbers (AI_STREAM_USAGE=0 opts out).
        ...(stream && process.env.AI_STREAM_USAGE !== "0" ? { stream_options: { include_usage: true } } : {}),
        temperature,
        // Ceilings: reasoning models spend hidden tokens first, but providers reserve credit against max_tokens.
        max_tokens: body.mode === "hints" ? 1500 : body.mode === "suggest" ? 5000 : body.mode === "analyze" ? 4000 : brief.chain ? 10000 : 6000,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  let upstream: Response;
  try {
    const jsonOut = body.mode === "analyze" || body.mode === "suggest" || body.mode === "hints";
    upstream = await call(jsonOut);
    // Some models reject response_format — retry once without it (prompt already demands JSON).
    if (!upstream.ok && jsonOut && upstream.status === 400) upstream = await call(false);
  } catch (e) {
    console.error("[generate] upstream unreachable", e);
    await release(reservation);
    return json(502, { error: GENERIC_FAIL, code: "upstream" });
  }

  if (!upstream.ok) {
    await release(reservation);
    // Log the real error server-side only; never leak provider details to the client.
    console.error("[generate] upstream error", upstream.status, (await upstream.text().catch(() => "")).slice(0, 1000));
    if (upstream.status === 429) return json(429, { error: "The AI service is busy. Try again in a moment.", code: "busy" });
    if (upstream.status === 402) return json(503, { error: "AI generation is temporarily unavailable.", code: "unavailable" });
    return json(502, { error: GENERIC_FAIL, code: "upstream" });
  }

  // The reservation stands once the provider has accepted the call; only the token count is settled below.
  const inputChars = messages.map((m) => m.content).join("");

  if (!stream) {
    const data = await upstream.json().catch(() => null);
    const rawOut: string = data?.choices?.[0]?.message?.content ?? "";
    let tokensUsed: number = data?.usage?.total_tokens ?? estimateTokens(inputChars, rawOut);
    // Suggest may make a follow-up call; it settles after that.
    if (body.mode !== "suggest") await settle(reservation, tokensUsed);
    if (rawOut.includes(canary)) {
      console.error("[guard] canary leak blocked", { subject: viewer.subject, mode: body.mode });
      return json(422, { error: "That request couldn't be processed.", code: "blocked" });
    }
    const cleaned = rawOut.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    if (body.mode === "hints") {
      try {
        const p = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
        const src = p?.hints && typeof p.hints === "object" ? p.hints : p;
        const hints: Record<string, string> = {};
        for (const f of hintFields) {
          const v = cleanText(src?.[f], 160).replace(/\s+/g, " ").replace(/…$/, "").trim();
          if (v) hints[f] = v;
        }
        return json(200, { hints });
      } catch {
        return json(200, { hints: {} });
      }
    }
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
                content: `${framing}\n\nCURRENT BRIEF:\n${untrusted("brief", briefToText({ ...brief, ...values } as Brief))}\n\n${suggestRequest(brief, missing, persona)}`,
              },
            ],
          }),
        }).catch(() => null);
        if (retry?.ok) {
          const d2 = await retry.json().catch(() => null);
          const raw2: string = d2?.choices?.[0]?.message?.content ?? "";
          tokensUsed += d2?.usage?.total_tokens ?? estimateTokens(inputChars, raw2);
          if (!raw2.includes(canary)) Object.assign(values, parseSuggestions(raw2.replace(/^```(?:json)?\s*|\s*```$/g, "").trim(), missing));
        }
      }
      await settle(reservation, tokensUsed);
      if (!Object.keys(values).length) return json(502, { error: "No suggestion produced. Try again.", code: "empty_output" });
      return json(200, { values });
    }
    try {
      const p = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      if (p?.understood === false || p?.unclear === true) {
        console.warn("[guard] unclear objective (analyze)", { subject: viewer.subject });
        return unclear();
      }
      const q = (Array.isArray(p.questions) ? p.questions : [])
        .slice(0, 4)
        .map((x: { question?: unknown; why?: unknown; suggestion?: unknown }) => ({
          question: cleanText(x?.question, 500),
          why: cleanText(x?.why, 300),
          suggestion: cleanText(x?.suggestion, LIMITS.answer),
        }))
        .filter((x: { question: string }) => x.question);
      return tagLeftOut(json(200, {
        score: Math.max(0, Math.min(100, Number(p.score) || 0)),
        gaps: (Array.isArray(p.gaps) ? p.gaps : []).slice(0, 6).map((g: unknown) => cleanText(g, 300)).filter(Boolean),
        questions: q,
        details: (Array.isArray(p.details) ? p.details : [])
          .map((x: { label?: unknown; hint?: unknown }) => ({ label: cleanText(x?.label, 80).trim(), hint: cleanText(x?.hint, 120).trim() }))
          .filter((x: { label: string }) => x.label)
          .slice(0, 6),
      }));
    } catch {
      return json(200, { score: 50, gaps: [], questions: [], details: [] });
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
      // Hold the first characters back until we know they aren't the "unclear objective" marker,
      // so the marker never flashes on screen as if it were a prompt.
      let holding = body.mode === "generate";
      const emit = (t: string) => controller.enqueue(encoder.encode(t.replaceAll(canary, "")));
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
              // Read before the delta handling below, which can `continue` past it.
              if (choice?.finish_reason) finish = choice.finish_reason;
              if (delta) {
                full += delta;
                if (holding) {
                  const head = full.trimStart();
                  if (head.length <= UNCLEAR_MARKER.length && UNCLEAR_MARKER.startsWith(head)) continue;
                  if (head.startsWith(UNCLEAR_MARKER)) continue; // stays held; judged at the end
                  holding = false;
                  emit(full);
                  continue;
                }
                // Strip the canary if it arrives whole in one delta; split canaries are caught by the final check (output discarded).
                emit(delta);
              }
            } catch {
              /* keep-alive / partial */
            }
          }
        }
      } catch (e) {
        failed = true;
        console.error("[generate] stream read failed", e);
      } finally {
        const used = tokens ?? estimateTokens(inputChars, full);
        // Also catch the model writing a prompt anyway while saying the objective is nonsense (seen live, 16 Nov 2026).
        const isUnclear =
          body.mode === "generate" && (full.trim().startsWith(UNCLEAR_MARKER) || SAYS_GIBBERISH.test(full));
        // An unclear objective produced no prompt, so it doesn't count against the user's quota.
        if (isUnclear) await refund(reservation, used);
        else await settle(reservation, used);
        let status: string | null = null;
        if (!failed && finish) {
          status = finish === "length" ? "len" : "ok";
          if (isUnclear) {
            status = "unclear";
            console.warn("[guard] unclear objective (generate)", { subject: viewer.subject });
          } else if (full.includes(canary)) {
            status = "blocked";
            console.error("[guard] canary leak blocked", { subject: viewer.subject, mode: body.mode });
          } else if (requiredHeadings(brief).length && missingSections(full, brief).length === requiredHeadings(brief).length && !brief.chain) {
            // Not a prompt at all (e.g. the model was steered into answering the task directly).
            status = "off";
            console.warn("[guard] off-task output", { subject: viewer.subject, mode: body.mode, len: full.length });
          }
        } else console.error("[generate] stream ended without clean finish", { finish, failed });
        // Short output still held back at the end (not the marker): release it now.
        if (holding && !isUnclear && status !== "blocked") emit(full);
        if (status) controller.enqueue(encoder.encode(EOT + status));
        controller.close();
      }
    },
  });

  return tagLeftOut(new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }));
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

const SAYS_GIBBERISH = /\bobjective\b[^.\n]{0,40}\b(is|was|appears|seems|looks)\b[^.\n]{0,30}\b(gibberish|garbled|unintelligible|nonsensical|keyboard mash|random (characters|letters))/i;
