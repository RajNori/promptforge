import { NextRequest } from "next/server";
import {
  ANALYZE_SYSTEM,
  briefToText,
  generateSystem,
  migrateBrief,
  refineSystem,
  targetGuidance,
  type Brief,
  type Clarification,
} from "@/lib/forge";

export const runtime = "nodejs";
export const maxDuration = 60;

// Provider is fully server-side and env-driven (any OpenAI-compatible chat completions endpoint).
// Nothing about the provider or model is ever sent to the browser.
const cfg = () => ({
  url: process.env.AI_BASE_URL?.replace(/\/+$/, "") ?? "",
  // Legacy key name kept as a fallback; prefer AI_API_KEY.
  key: process.env.AI_API_KEY || process.env.OPEN_ROUTER_API_KEY || "",
  model: process.env.AI_MODEL ?? "",
});
const configured = () => {
  const c = cfg();
  return Boolean(c.url && c.key && c.model);
};

// Best-effort per-instance rate limit (20 req / 10 min / IP). Not a substitute for ACCESS_CODE.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

type Body =
  | { mode: "analyze"; brief: Brief }
  | { mode: "generate"; brief: Brief; clarifications: Clarification[] }
  | { mode: "refine"; brief: Brief; prompt: string; feedback: string };

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const GENERIC_FAIL = "Generation failed. Please try again.";

export async function GET() {
  return json(200, { configured: configured(), requiresAccessCode: Boolean(process.env.ACCESS_CODE) });
}

export async function POST(req: NextRequest) {
  if (!configured()) return json(503, { error: "AI generation isn't configured. Use Instant template mode." });
  const { url, key, model } = cfg();

  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) return json(401, { error: "Invalid access code." });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (limited(ip)) return json(429, { error: "Rate limit hit. Try again in a few minutes." });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body?.brief) return json(400, { error: "Brief is required." });
  body.brief = migrateBrief(body.brief);
  if (!body.brief.objective.trim() && body.mode !== "refine") return json(400, { error: "Objective is required." });

  const guidance = targetGuidance(body.brief.target);

  let messages: { role: string; content: string }[];
  let stream = true;
  let temperature = 0.4;

  if (body.mode === "analyze") {
    stream = false;
    temperature = 0.2;
    messages = [
      { role: "system", content: ANALYZE_SYSTEM },
      { role: "user", content: `${guidance}\n\nBRIEF:\n${briefToText(body.brief)}` },
    ];
  } else if (body.mode === "generate") {
    messages = [
      { role: "system", content: generateSystem(body.brief) },
      { role: "user", content: `${guidance}\n\nWrite the prompt for this brief:\n\n${briefToText(body.brief, body.clarifications)}` },
    ];
  } else if (body.mode === "refine") {
    if (!body.prompt?.trim() || !body.feedback?.trim()) return json(400, { error: "Prompt and feedback are required." });
    messages = [
      { role: "system", content: refineSystem(body.brief) },
      {
        role: "user",
        content: `${guidance}\n\nORIGINAL BRIEF:\n${briefToText(body.brief)}\n\nCURRENT PROMPT:\n<<<\n${body.prompt.slice(0, 30_000)}\n>>>\n\nFEEDBACK TO APPLY:\n${body.feedback.slice(0, 4_000)}`,
      },
    ];
  } else {
    return json(400, { error: "Unknown mode" });
  }

  const call = (jsonMode: boolean) =>
    fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream,
        temperature,
        max_tokens: body.brief.chain ? 9000 : 4500,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  let upstream: Response;
  try {
    upstream = await call(body.mode === "analyze");
    // Some models reject response_format — retry once without it (prompt already demands JSON).
    if (!upstream.ok && body.mode === "analyze" && upstream.status === 400) upstream = await call(false);
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

  if (!stream) {
    const data = await upstream.json().catch(() => null);
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      return json(200, {
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 6) : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 4) : [],
      });
    } catch {
      return json(200, { score: 50, gaps: [], questions: [] });
    }
  }

  // Re-stream upstream SSE as plain text chunks (content deltas only).
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      let buf = "";
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
                controller.enqueue(encoder.encode("\n\n[generation interrupted — try again]"));
              }
              const delta = evt?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* keep-alive / partial */
            }
          }
        }
      } catch (e) {
        console.error("[generate] stream read failed", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
