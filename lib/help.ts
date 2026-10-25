// Field guidance — shared by the UI tooltips and the AI field-suggest endpoint.

import { resolveFramework, type Brief } from "./forge";
import type { PersonaId } from "./personas";

export type SuggestField =
  | "role"
  | "objective"
  | "context"
  | "inputs"
  | "deliverable"
  | "successCriteria"
  | "rules"
  | "audience"
  | "tone"
  | "outputFormat"
  | "prefill"
  | "outputSchema";

export const SUGGEST_FIELDS: SuggestField[] = [
  "role",
  "objective",
  "context",
  "inputs",
  "deliverable",
  "successCriteria",
  "rules",
  "audience",
  "tone",
  "outputFormat",
  "prefill",
  "outputSchema",
];

export type FieldHelp = { label: string; tip: string; good: string; avoid?: string };

export const FIELD_HELP: Record<SuggestField | "examples", FieldHelp> = {
  role: {
    label: "Role",
    tip: "Name a specific expert: seniority and specialty (e.g. children's picture-book author, senior Postgres engineer). Specific roles pull specific knowledge.",
    good: "Staff backend engineer specialising in Postgres performance and Supabase RLS",
    avoid: "Helpful assistant · expert developer",
  },
  objective: {
    label: "Objective",
    tip: "One outcome, verb-first. Say what is different in the world when it's done.",
    good: "Add CSV export to the admin users table that respects the current filters",
    avoid: "Improve the admin page",
  },
  context: {
    label: "Context",
    tip: "Facts the model can't guess: background, what exists today, constraints, who it's for.",
    good: "Next.js 16 App Router + Supabase. users table ~40k rows. Exports are done manually via SQL today.",
    avoid: "Our app",
  },
  inputs: {
    label: "Inputs / assets",
    tip: "What the model can read or use: notes, documents, data, files, links. Never paste secrets.",
    good: "/lib/db.ts, /app/admin/users/page.tsx, sample export in /fixtures/users.csv",
  },
  deliverable: {
    label: "Deliverable",
    tip: "The concrete thing you want back and its shape: length, sections, format (story, email, doc, PR, JSON…).",
    good: "A PR with route handler, export button component, and tests",
    avoid: "A solution",
  },
  successCriteria: {
    label: "Success criteria",
    tip: "Testable checks, one per line. If you couldn't verify it, rewrite it.",
    good: "10k-row export completes in < 5s\nCSV opens cleanly in Excel (UTF-8 BOM)\nAll tests and typecheck pass",
    avoid: "Works well · is fast",
  },
  rules: {
    label: "Rules",
    tip: "Hard limits plus the reason. Reasons let the model generalise to cases you didn't list.",
    good: "No new dependencies — because the bundle budget is already at its limit",
    avoid: "Be careful · follow best practices",
  },
  audience: {
    label: "Audience",
    tip: "Who reads it, what they already know, and what they need to decide or do.",
    good: "Ops leads at 50–500 person companies; non-technical; skimming on mobile",
    avoid: "Everyone",
  },
  tone: {
    label: "Tone",
    tip: "Two to four adjectives plus one thing to avoid.",
    good: "Plain, confident, a little dry — no hype words or exclamation marks",
  },
  outputFormat: {
    label: "Response format",
    tip: "Exact structure of the answer: sections, length, markdown/JSON, and what to leave out.",
    good: "Markdown: TL;DR (2 lines), comparison table, recommendation, risks. Max 400 words.",
  },
  prefill: {
    label: "Prefill",
    tip: "The first tokens of the assistant's reply, sent by your app. Locks the output format.",
    good: '{"category":',
  },
  outputSchema: {
    label: "Output schema",
    tip: "JSON Schema your app will parse. Include required[] and enums so the output is machine-checkable.",
    good: '{"type":"object","properties":{"urgency":{"enum":["low","high"]}},"required":["urgency"]}',
  },
  examples: {
    label: "Few-shot examples",
    tip: "1–3 ideal input→output pairs. Diverse beats many — cover the edge case you care about most.",
    good: "Input: 'Login broken for all users' → Output: {\"urgency\":\"high\",\"area\":\"auth\"}",
  },
};

/** Fields that are relevant for this brief (framework / target dependent). */
export function applicableFields(b: Brief): SuggestField[] {
  const fw = resolveFramework(b);
  return SUGGEST_FIELDS.filter((f) => {
    if (f === "audience" || f === "tone") return fw.usesAudienceTone;
    if (f === "prefill" || f === "outputSchema") return b.target === "api-system";
    return true;
  });
}

export function isEmpty(b: Brief, f: SuggestField): boolean {
  if (f === "rules") return !b.rules.some((r) => r.rule.trim());
  return !String(b[f] ?? "").trim();
}

/** Enough signal to suggest anything? */
export function hasSignal(b: Brief): boolean {
  return [b.objective, b.context, b.deliverable, b.role, b.inputs].some((v) => v.trim().length > 3);
}

export const SUGGEST_SYSTEM = `You are a principal prompt engineer helping a user complete a prompt brief. You write values for specific brief fields.

Rules:
- Ground every value in what the brief already says (objective, context, task type, the user's role, other fields). Never contradict it.
- The OBJECTIVE is the source of truth. Every value must be recognisably about it (a children's book gets ages, read-aloud, illustrations — never blogs, finance or code). If a value could belong to a different task, rewrite it.
- Never invent facts the user hasn't given: names, characters, plots, brands, prices, dates, page counts, numbers. Where a specific detail is needed but unknown, write a fill-in in square brackets with a short hint, e.g. "[age range, e.g. 4–6]" or "[main character's name]".
- Prefer sensible, widely-true defaults for the domain over guesses, and keep the user's own wording.
- Keep values tight: role/tone/audience ≤ 20 words; objective/context/deliverable ≤ 2 sentences; response format ≤ 2 sentences.
- Success criteria: 3–5 lines, one testable check per line, each ≤ 18 words, no bullets or numbering, no "verified by…" instructions.
- Rules: 3–5 items; rule ≤ 14 words; why ≤ 12 words, stating the consequence it prevents.
- If a field already has a value, return an improved version that keeps the user's intent and specifics.
- You MUST return every requested key. Never omit a key.
- Never invent secrets, credentials, or personal data.

Respond with ONLY valid JSON, no prose, no code fences.`;

export function suggestRequest(b: Brief, fields: SuggestField[], persona?: PersonaId | null): string {
  void persona;
  const shape: Record<string, string> = {};
  for (const f of fields) shape[f] = f === "rules" ? '[{"rule": "...", "why": "..."}]' : '"..."';
  return `THE TASK (source of truth): ${b.objective.trim() || "(see context)"}\n\nFIELDS TO WRITE:\n${fields
    .map((f) => {
      const h = FIELD_HELP[f];
      const cur = f === "rules" ? b.rules.filter((r) => r.rule.trim()).map((r) => `${r.rule} — ${r.why}`).join("; ") : String(b[f] ?? "");
      return `- ${f} (${h.label}): ${h.tip}${cur.trim() ? `\n  CURRENT VALUE (improve it): ${cur}` : ""}`;
    })
    .join("\n")}\n\nReturn JSON exactly in this shape: {${Object.entries(shape)
    .map(([k, v]) => `"${k}": ${v}`)
    .join(", ")}}`;
}


// ---------------------------------------------------------------- Live field hints (placeholders tailored to the objective)

/** Fields that get live example placeholders. */
export const HINT_FIELDS = ["role", "context", "audience", "tone", "deliverable", "successCriteria", "rule", "why", "inputs", "outputFormat"] as const;
export type HintField = (typeof HINT_FIELDS)[number];

export const HINTS_SYSTEM = `You write short EXAMPLE placeholders that show a person what a good answer to each form field looks like for THEIR task. They are greyed-out hints, not answers.

Rules:
- Every hint must be recognisably about the person's objective. A children's book gets reader ages, read-aloud, page count, illustrations; a cold email gets prospects, offer, CTA. Never generic, never about a different domain.
- Concrete and illustrative: realistic example values are fine because they are clearly examples.
- Each hint ≤ 14 words, no trailing ellipsis. successCriteria: 2 short checks separated by "; ". rule: a short rule; why: its reason (≤ 8 words, no "because").
- Software, files or tooling only if the objective is software work.
- Respond with ONLY valid JSON: {"hints": {"<field>": "<hint>", ...}} with every requested field.`;

export function hintsRequest(b: Brief, fields: readonly HintField[]): string {
  return `OBJECTIVE: ${b.objective.trim()}
TASK TYPE: ${b.taskType}
${b.context.trim() ? `CONTEXT SO FAR: ${b.context.trim().slice(0, 600)}\n` : ""}FIELDS: ${fields.join(", ")}
(role = the expert the AI should act as; context = background the AI needs; audience = who it's for; tone = how it should sound; deliverable = what to hand back; successCriteria = how to judge it; rule/why = one must-do or don't and its reason; inputs = material the person can provide; outputFormat = structure and length of the answer)`;
}
