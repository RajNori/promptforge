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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Accept both spellings of the key env var.
const API_KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || process.env.OPEN_ROUTER_MODEL || "deepseek/deepseek-v4.1-flash";

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
  | { mode: "analyze"; brief: Brief; model?: string }
  | { mode: "generate"; brief: Brief; clarifications: Clarification[]; model?: string }
  | { mode: "refine"; brief: Brief; prompt: string; feedback: string; model?: string };

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export async function GET() {
  return json(200, {
    configured: Boolean(API_KEY()),
    requiresAccessCode: Boolean(process.env.ACCESS_CODE),
    defaultModel: DEFAULT_MODEL,
  });
}

export async function POST(req: NextRequest) {
  const key = API_KEY();
  if (!key) return json(503, { error: "OPEN_ROUTER_API_KEY is not configured. Use Instant template mode or set the env var." });

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

  const model = (body.model?.trim() || DEFAULT_MODEL).slice(0, 120);
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
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers.get("origin") ?? "https://risen-forge.vercel.app",
        "X-Title": "Prompt Forge",
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        temperature,
        max_tokens: body.brief.chain ? 9000 : 4500,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  let upstream = await call(body.mode === "analyze");
  // Some models reject response_format — retry once without it (prompt already demands JSON).
  if (!upstream.ok && body.mode === "analyze" && upstream.status === 400) upstream = await call(false);

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    let msg = text;
    try {
      msg = JSON.parse(text)?.error?.message ?? text;
    } catch {}
    return json(upstream.status, { error: `OpenRouter ${upstream.status}: ${msg.slice(0, 400)}` });
  }

  if (!stream) {
    const data = await upstream.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      return json(200, {
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 6) : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 4) : [],
        model,
      });
    } catch {
      return json(200, { score: 50, gaps: [], questions: [], model, warning: "Analysis unparseable; skipped." });
    }
  }

  // Re-stream OpenRouter SSE as plain text chunks.
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
              if (evt.error) controller.enqueue(encoder.encode(`\n\n[error] ${evt.error.message ?? "stream error"}`));
              const delta = evt?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* keep-alive / partial */
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-model": model },
  });
}
