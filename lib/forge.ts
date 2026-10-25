// Prompt Forge domain: one brief, many frameworks. Registry, auto-pick, generator contracts,
// validation, and an offline template compiler.

export type Target = "claude-code" | "cursor" | "codex" | "chat-llm" | "multi-agent" | "api-system";
export type Autonomy = "ask-first" | "bounded" | "autonomous";
export type Depth = "lean" | "standard" | "exhaustive";
export type Syntax = "markdown" | "xml";
export type FrameworkId = "risen" | "costar" | "rtf" | "crispe" | "bab";

export interface Rule {
  rule: string;
  why: string;
}
export interface Example {
  input: string;
  output: string;
}

export interface Brief {
  framework: FrameworkId | "auto";
  target: Target;
  taskType: string;
  objective: string;
  role: string;
  context: string;
  inputs: string;
  deliverable: string;
  successCriteria: string;
  rules: Rule[];
  outputFormat: string;
  audience: string;
  tone: string;
  examples: Example[];
  chain: boolean;
  prefill: string;
  outputSchema: string;
  autonomy: Autonomy;
  depth: Depth;
  syntax: Syntax;
  extensions: {
    acceptanceCriteria: boolean;
    evidence: boolean;
    authorityBoundaries: boolean;
    definitionOfDone: boolean;
    selfCritique: boolean;
    examples: boolean;
  };
}

export interface Clarification {
  question: string;
  why: string;
  answer?: string;
}

export interface Analysis {
  score: number;
  gaps: string[];
  questions: Clarification[];
}

export const TARGETS: { id: Target; label: string; hint: string }[] = [
  { id: "claude-code", label: "Claude Code", hint: "Agentic CLI with tools, files, shell" },
  { id: "cursor", label: "Cursor", hint: "IDE agent, repo-scoped" },
  { id: "codex", label: "Codex", hint: "Autonomous coding agent" },
  { id: "multi-agent", label: "Multi-agent", hint: "Orchestrator + bounded sub-agents" },
  { id: "chat-llm", label: "Chat LLM", hint: "Claude / ChatGPT / Gemini chat" },
  { id: "api-system", label: "API system prompt", hint: "Production system prompt for an app" },
];

export const TASK_TYPES = [
  "Build a feature",
  "Fix a bug",
  "Refactor / migrate",
  "Architecture / design",
  "Code review / audit",
  "Research & analysis",
  "Writing / content",
  "Data / reporting",
  "Product / strategy",
  "Email / message",
  "Marketing & ads",
  "Study & learning",
  "Planning & admin",
  "Other",
] as const;

export const EMPTY_BRIEF: Brief = {
  framework: "auto",
  target: "claude-code",
  taskType: "Build a feature",
  objective: "",
  role: "",
  context: "",
  inputs: "",
  deliverable: "",
  successCriteria: "",
  rules: [{ rule: "", why: "" }],
  outputFormat: "",
  audience: "",
  tone: "",
  examples: [],
  chain: false,
  prefill: "",
  outputSchema: "",
  autonomy: "bounded",
  depth: "standard",
  syntax: "markdown",
  extensions: {
    acceptanceCriteria: true,
    evidence: true,
    authorityBoundaries: true,
    definitionOfDone: true,
    selfCritique: false,
    examples: false,
  },
};

/** Accept briefs saved by older versions (free-text `constraints`). */
export function migrateBrief(raw: unknown): Brief {
  const r = (raw ?? {}) as Partial<Brief> & { constraints?: string };
  const b: Brief = { ...EMPTY_BRIEF, ...r, extensions: { ...EMPTY_BRIEF.extensions, ...(r.extensions ?? {}) } };
  if ((!r.rules || !r.rules.length) && typeof r.constraints === "string" && r.constraints.trim()) {
    b.rules = r.constraints
      .split("\n")
      .map((l) => l.replace(/^[-*•\s]+/, "").trim())
      .filter(Boolean)
      .map((l) => {
        const [rule, ...why] = l.split(/\s+[—–-]\s+|\s*because\s*/i);
        return { rule: rule.trim(), why: why.join(" ").trim() };
      });
  }
  if (!b.rules?.length) b.rules = [{ rule: "", why: "" }];
  if (!Array.isArray(b.examples)) b.examples = [];
  delete (b as Brief & { constraints?: string }).constraints;
  return b;
}

// ---------------------------------------------------------------- Frameworks

type Section = { label: string; from: (keyof Brief)[]; guide: string };
export type Framework = {
  id: FrameworkId;
  name: string;
  expansion: string;
  tagline: string;
  bestFor: string[];
  sections: Section[];
  usesAudienceTone: boolean;
  hasResponseSection: boolean;
};

export const FRAMEWORKS: Record<FrameworkId, Framework> = {
  risen: {
    id: "risen",
    name: "RISEN",
    expansion: "Role · Instructions · Steps · End goal · Narrowing",
    tagline: "Multi-step, constraint-heavy, agentic work",
    bestFor: ["Build a feature", "Fix a bug", "Refactor / migrate", "Architecture / design", "Code review / audit"],
    usesAudienceTone: false,
    hasResponseSection: false,
    sections: [
      { label: "Role", from: ["role"], guide: "a specific senior expert with named domain expertise — never generic" },
      { label: "Instructions", from: ["objective", "context", "inputs"], guide: "what to accomplish plus essential context, stack, inputs" },
      { label: "Steps", from: ["autonomy", "taskType"], guide: "ordered, verifiable execution sequence; each step produces something checkable" },
      { label: "End Goal", from: ["deliverable", "successCriteria"], guide: "the deliverable and measurable success criteria" },
      { label: "Narrowing", from: ["rules"], guide: "scope limits and prohibitions, each with its reason" },
    ],
  },
  costar: {
    id: "costar",
    name: "CO-STAR",
    expansion: "Context · Objective · Style · Tone · Audience · Response",
    tagline: "Writing and content where voice and reader matter",
    bestFor: ["Writing / content"],
    usesAudienceTone: true,
    hasResponseSection: true,
    sections: [
      { label: "Context", from: ["context", "inputs"], guide: "background the model needs" },
      { label: "Objective", from: ["objective", "deliverable"], guide: "the exact task" },
      { label: "Style", from: ["role", "taskType"], guide: "writing style / expert voice to emulate" },
      { label: "Tone", from: ["tone"], guide: "emotional register and attitude" },
      { label: "Audience", from: ["audience"], guide: "who reads it, what they know, what they need" },
      { label: "Response", from: ["outputFormat", "successCriteria", "rules"], guide: "exact output format, length, constraints with reasons" },
    ],
  },
  rtf: {
    id: "rtf",
    name: "RTF",
    expansion: "Role · Task · Format",
    tagline: "Quick, well-scoped single-shot asks",
    bestFor: ["Research & analysis", "Data / reporting", "Other"],
    usesAudienceTone: false,
    hasResponseSection: true,
    sections: [
      { label: "Role", from: ["role"], guide: "the expert persona" },
      { label: "Task", from: ["objective", "context", "inputs", "successCriteria", "rules"], guide: "the task with context, criteria, and constraints with reasons" },
      { label: "Format", from: ["outputFormat", "deliverable"], guide: "precise output structure" },
    ],
  },
  crispe: {
    id: "crispe",
    name: "CRISPE",
    expansion: "Capacity & Role · Insight · Statement · Personality · Experiment",
    tagline: "Strategy and ideation where you want options",
    bestFor: ["Product / strategy"],
    usesAudienceTone: true,
    hasResponseSection: false,
    sections: [
      { label: "Capacity and Role", from: ["role"], guide: "the expert capacity the model operates in" },
      { label: "Insight", from: ["context", "inputs", "audience"], guide: "background insight, market/user context, stakeholders" },
      { label: "Statement", from: ["objective", "deliverable", "successCriteria", "rules"], guide: "what exactly to produce, criteria, constraints with reasons" },
      { label: "Personality", from: ["tone"], guide: "voice and stance of the response" },
      { label: "Experiment", from: ["outputFormat"], guide: "how many distinct alternatives/variants to produce and how to compare them" },
    ],
  },
  bab: {
    id: "bab",
    name: "BAB",
    expansion: "Before · After · Bridge",
    tagline: "Transformations: migrations, rewrites, turnarounds",
    bestFor: [],
    usesAudienceTone: false,
    hasResponseSection: false,
    sections: [
      { label: "Before", from: ["context", "inputs"], guide: "the current state and its problems, concretely" },
      { label: "After", from: ["objective", "successCriteria"], guide: "the desired end state, measurable" },
      { label: "Bridge", from: ["deliverable", "rules", "autonomy"], guide: "the path from before to after: steps, deliverable, constraints with reasons" },
    ],
  },
};

export const FRAMEWORK_ORDER: FrameworkId[] = ["risen", "costar", "rtf", "crispe", "bab"];

const AGENTIC: Target[] = ["claude-code", "cursor", "codex", "multi-agent"];
export const isAgentic = (t: Target) => AGENTIC.includes(t);

/** Task types where a coding-agent target makes sense. */
export const ENGINEERING_TASKS = new Set(["Build a feature", "Fix a bug", "Refactor / migrate", "Architecture / design", "Code review / audit"]);
export const isEngineering = (taskType: string) => ENGINEERING_TASKS.has(taskType);
/** Agent-only extensions: meaningless (and harmful) in a chat or app prompt. */
export const AGENT_ONLY_EXT = ["evidence", "authorityBoundaries", "definitionOfDone"] as const;

/**
 * One decision drives every stage: what kind of job is this?
 * A non-software task from a non-developer never gets coding-agent framing, whatever the stored target says.
 */
export function normalizeBrief(b: Brief, persona?: string | null): Brief {
  let out = b;
  if (!isEngineering(b.taskType) && isAgentic(b.target) && persona !== "developer") out = { ...out, target: "chat-llm" };
  if (!isAgentic(out.target)) {
    out = {
      ...out,
      extensions: {
        ...out.extensions,
        authorityBoundaries: false,
        definitionOfDone: false,
        // Evidence (sources) still helps research/data work in chat; elsewhere it's agent noise.
        evidence: out.extensions.evidence && (out.taskType === "Research & analysis" || out.taskType === "Data / reporting"),
      },
    };
  }
  return out;
}

export function autoPick(target: Target, taskType: string): FrameworkId {
  // Audience- and voice-driven work → CO-STAR.
  if (taskType === "Writing / content" || taskType === "Email / message" || taskType === "Marketing & ads") return "costar";
  if (taskType === "Study & learning") return "rtf";
  if (taskType === "Planning & admin") return "risen";
  if (taskType === "Product / strategy") return "crispe";
  if (taskType === "Refactor / migrate") return isAgentic(target) ? "risen" : "bab";
  if (taskType === "Research & analysis" || taskType === "Data / reporting" || taskType === "Other")
    return isAgentic(target) ? "risen" : "rtf";
  return "risen";
}

export function resolveFramework(b: Brief): Framework {
  return FRAMEWORKS[b.framework === "auto" ? autoPick(b.target, b.taskType) : b.framework];
}

// ---------------------------------------------------------------- Shared text helpers

const TARGET_GUIDANCE: Record<Target, string> = {
  "claude-code":
    "Target is Claude Code (agentic CLI: reads/edits files, runs shell, uses sub-agents, plan mode, CLAUDE.md). Reference concrete verification commands (typecheck, lint, test, build). Tell it to explore before editing, use a todo list for multi-step work, and report evidence (command output) for every completion claim.",
  cursor:
    "Target is Cursor's agent (repo-scoped IDE agent). Keep scope to named files/dirs, prefer minimal diffs, require running tests in the integrated terminal, and ask it to list changed files at the end.",
  codex:
    "Target is an autonomous coding agent (Codex-style, sandboxed, often unattended). Make it fully self-contained: no assumption of follow-up questions, explicit stop conditions, and a final report with diffs summary and test output.",
  "multi-agent":
    "Target is a multi-agent workflow. Define an orchestrator role plus bounded sub-agent roles, hand-off contracts (inputs/outputs), and an independent reviewer that did not author the work.",
  "chat-llm":
    "Target is a conversational LLM. Optimise for a single high-quality response; specify output structure precisely; no tool assumptions.",
  "api-system":
    "Target is a production system prompt embedded in an application. Write in second person to the model, cover edge cases, refusal/escalation behaviour, output schema, and tone. No placeholders the app can't fill.",
};
export const targetGuidance = (t: Target) => TARGET_GUIDANCE[t];

const AUTONOMY_GUIDANCE: Record<Autonomy, string> = {
  "ask-first": "Present a plan and wait for approval before any file change or side effect.",
  bounded: "Act within the stated scope without asking; stop and escalate on anything outside scope, destructive, or irreversible.",
  autonomous: "Run end-to-end without check-ins; decide reasonable defaults, record assumptions, and stop only for hard blockers or irreversible/destructive actions.",
};

export const activeRules = (b: Brief) => b.rules.filter((r) => r.rule.trim());
export const activeExamples = (b: Brief) => b.examples.filter((e) => e.input.trim() || e.output.trim());

function rulesText(b: Brief) {
  return activeRules(b)
    .map((r) => `- ${r.rule.trim()}${r.why.trim() ? ` — because ${r.why.trim()}` : ""}`)
    .join("\n");
}

export function briefToText(b: Brief, clarifications: Clarification[] = []): string {
  const fw = resolveFramework(b);
  const ext = Object.entries(b.extensions)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");
  const answered = clarifications.filter((c) => c.answer?.trim());
  const ex = activeExamples(b);
  return [
    `FRAMEWORK: ${fw.name} (${fw.expansion})${b.framework === "auto" ? " — auto-selected" : ""}`,
    `TARGET: ${TARGETS.find((t) => t.id === b.target)?.label ?? b.target}`,
    `TASK TYPE: ${b.taskType}`,
    `OBJECTIVE: ${b.objective || "(not given)"}`,
    `ROLE: ${b.role || "(infer the best expert role)"}`,
    `CONTEXT: ${b.context || "(none)"}`,
    `INPUTS / ASSETS: ${b.inputs || "(none)"}`,
    `DELIVERABLE: ${b.deliverable || "(infer)"}`,
    `SUCCESS CRITERIA: ${b.successCriteria || "(infer measurable criteria)"}`,
    `RULES (with reasons):\n${rulesText(b) || "(infer sensible guardrails)"}`,
    fw.usesAudienceTone || b.audience.trim() ? `AUDIENCE: ${b.audience || "(infer)"}` : "",
    fw.usesAudienceTone || b.tone.trim() ? `TONE: ${b.tone || "(infer)"}` : "",
    `RESPONSE FORMAT: ${b.outputFormat || "(choose the best)"}`,
    isAgentic(b.target) ? `AUTONOMY: ${b.autonomy} — ${AUTONOMY_GUIDANCE[b.autonomy]}` : "",
    `DEPTH: ${b.depth}`,
    `MODE: ${b.chain ? "prompt chain (2–4 sequenced prompts)" : "single prompt"}`,
    `SYNTAX: ${b.syntax}`,
    `EXTENSIONS: ${ext || "none"}`,
    ex.length ? `FEW-SHOT EXAMPLES (${ex.length}):\n${ex.map((e, i) => `#${i + 1} INPUT:\n${e.input}\n#${i + 1} OUTPUT:\n${e.output}`).join("\n")}` : "",
    b.target === "api-system" && b.prefill.trim() ? `ASSISTANT PREFILL: ${b.prefill}` : "",
    b.target === "api-system" && b.outputSchema.trim() ? `OUTPUT JSON SCHEMA:\n${b.outputSchema}` : "",
    answered.length ? `CLARIFICATIONS:\n${answered.map((c) => `- Q: ${c.question}\n  A: ${c.answer}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------- Headings + contract

const snake = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
export const heading = (label: string, syntax: Syntax) => (syntax === "xml" ? `<${snake(label)}>` : `## ${label.toUpperCase()}`);

/** Extension sections (beyond the framework core) that apply to this brief, in order. */
export function extensionSections(b: Brief): { label: string; guide: string }[] {
  const fw = resolveFramework(b);
  const out: { label: string; guide: string }[] = [];
  if (activeExamples(b).length || b.extensions.examples)
    out.push({ label: "Examples", guide: "few-shot examples as <example><input>…</input><output>…</output></example> inside <examples>" });
  if (b.extensions.acceptanceCriteria) out.push({ label: "Acceptance Criteria", guide: "numbered, testable checklist" });
  if (b.extensions.authorityBoundaries && isAgentic(b.target))
    out.push({ label: "Authority Boundaries", guide: "free to change / needs approval / forbidden, plus escalation triggers" });
  if (b.extensions.evidence)
    out.push({
      label: "Evidence",
      guide: isAgentic(b.target) ? "every completion claim backed by command output, test results, file paths or sources" : "every factual claim backed by a cited source; say so when unsure",
    });
  if (b.extensions.selfCritique) out.push({ label: "Self-Critique", guide: "review own output against criteria and fix gaps before finalising" });
  if (b.extensions.definitionOfDone && isAgentic(b.target)) out.push({ label: "Definition of Done", guide: "done only when criteria and verification pass, or report exactly why not" });
  if (b.target === "api-system" && b.outputSchema.trim()) out.push({ label: "Output Schema", guide: "the JSON schema verbatim in a ```json block; respond with valid JSON only" });
  if (!fw.hasResponseSection) out.push({ label: "Final Report", guide: "exactly what to return when done" });
  if (b.target === "api-system" && b.prefill.trim())
    out.push({ label: "Assistant Prefill", guide: "the prefill text verbatim, labelled as the first assistant-turn content to send" });
  return out;
}

export function requiredHeadings(b: Brief): string[] {
  return resolveFramework(b).sections.map((s) => s.label);
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** Return framework core sections that are missing from the generated text. */
export function missingSections(text: string, b: Brief): string[] {
  const heads = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(#{1,4}\s|<[a-z_/]|\*\*|===)/i.test(l))
    .map((l) => norm(l.replace(/^#+|^<\/?|^\*\*/g, "").split(/[—:>(*]/)[0]));
  return requiredHeadings(b).filter((label) => !heads.some((h) => h === norm(label) || h.startsWith(norm(label))));
}

const PRIMER = `You are a principal prompt engineer. You know the major prompt frameworks:
- RISEN: Role, Instructions, Steps, End Goal, Narrowing — agentic, multi-step, constraint-heavy work.
- CO-STAR: Context, Objective, Style, Tone, Audience, Response — writing where voice and reader matter.
- RTF: Role, Task, Format — compact single-shot asks.
- CRISPE: Capacity and Role, Insight, Statement, Personality, Experiment — strategy/ideation with alternatives.
- BAB: Before, After, Bridge — transformations from a current state to a target state.
Cross-cutting techniques you apply: XML tags for structure, explaining the reason behind each constraint (models follow reasons better than bare rules), few-shot examples, explicit success criteria, evidence gates for agents, self-critique, prompt chaining for complex work, and prefill/output anchoring for API use.`;

function contract(b: Brief): string {
  const fw = resolveFramework(b);
  const ext = extensionSections(b);
  const fmt = b.syntax === "xml" ? "XML tags (e.g. <role>…</role>)" : "Markdown H2 headings (e.g. ## ROLE)";
  const ex = activeExamples(b);
  return [
    `OUTPUT CONTRACT — hard requirement. Framework: ${fw.name}. Use ${fmt}.`,
    `Core sections, exactly these headings, in this order:`,
    ...fw.sections.map((s, i) => `${i + 1}. ${heading(s.label, b.syntax)} — ${s.guide}`),
    ext.length ? `Then these additional sections, in this order:\n${ext.map((s) => `- ${heading(s.label, b.syntax)} — ${s.guide}`).join("\n")}` : "",
    `Do not rename, merge, or omit any listed section. Do not add other top-level sections.`,
    `Every rule/constraint must carry its reason ("— because …"). Keep the user's stated reasons; add a short reason to any non-obvious rule that lacks one.`,
    ex.length
      ? `Render the user's ${ex.length} few-shot example(s) verbatim inside <examples> as <example><input>…</input><output>…</output></example> (use these XML tags even in Markdown mode). Do not invent extra examples.`
      : b.extensions.examples
        ? `Write one short good and one short bad example inside <examples>, each as <example> with a one-line note on why.`
        : "",
    b.target === "api-system" && b.outputSchema.trim() ? `Embed the user's JSON schema verbatim and instruct the model to respond with valid JSON matching it and nothing else.` : "",
    b.target === "api-system" && b.prefill.trim()
      ? `In the Assistant Prefill section, reproduce the prefill text exactly and state that the application sends it as the beginning of the assistant turn to anchor the output.`
      : "",
    b.chain
      ? `CHAIN MODE: instead of one prompt, produce 2–4 sequential prompts (choose the count from task complexity; typical stages: understand/extract → analyse/plan → produce → verify). Start each with a line exactly "=== PROMPT k/N · STAGE NAME ===". Each prompt is self-contained, follows the full section contract above, states what it receives from the previous stage and the exact hand-off output it must produce for the next.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const ANALYZE_SYSTEM = `${PRIMER}

You are reviewing a prompt brief before writing the prompt. Ask the person for the missing information that only THEY know and that would most change the result. Ask at most 4 questions, fewer if the brief is strong. Never ask about things already answered. Each question must be specific to this task, in plain language, answerable in one line.

What to ask about — the person's intent and content, in their own domain:
- Who it's for, and what it should achieve for them.
- Specifics only the person knows: subject, key facts, names, offer, situation, constraints.
- Taste: tone, length, format, what good looks like, what to avoid.
- For software tasks only: scope boundaries, environment facts, risky operations, acceptance criteria.

Never ask about prompt mechanics or tooling — framework, chain steps, autonomy, evidence, files, repositories or how the AI should work. Those are your job, not theirs. Never ask about software, files or code for a non-software task.

Score reflects how well the brief captures the person's intent for THIS kind of task. Gaps are short, plain-language notes about missing intent, written for the person.

Respond with ONLY valid JSON, no prose, no code fences:
{"score": <0-100 completeness>, "gaps": ["short gap", ...], "questions": [{"question": "...", "why": "one short clause on why it matters"}]}`;

export function generateSystem(b: Brief): string {
  return `${PRIMER}

You write production-grade prompts. Rules:
1. Output ONLY the prompt${b.chain ? " chain" : ""}. No preamble, commentary, closing notes, or code fences around the whole thing.
2. Fill every section with task-specific content. No placeholders like [X]; if a value must be supplied at runtime use {{UPPER_SNAKE}}.
3. Infer expert defaults for anything not given; never contradict the brief.
4. Dense and precise: every line must change model behaviour. Cut generic filler unless made concrete.
5. Match depth: lean ≈ 150–300 words, standard ≈ 300–700, exhaustive ≈ 700–1400${b.chain ? " (per prompt in the chain, roughly halve these)" : ""}.

${contract(b)}`;
}

export function refineSystem(b: Brief): string {
  return `${PRIMER}

You are iterating on an existing prompt. Apply the user's feedback precisely while preserving everything that still holds. Output ONLY the revised prompt — no preamble, no change log, no code fences around the whole thing. Unless the feedback explicitly changes the framework or syntax, keep honouring this contract:

${contract(b)}`;
}

// ---------------------------------------------------------------- Offline template compiler

export function compileTemplate(b: Brief, clarifications: Clarification[] = []): string {
  const fw = resolveFramework(b);
  if (!b.chain) return compileOne(b, fw, clarifications);
  const stages: [string, string][] = [
    ["UNDERSTAND & PLAN", `Investigate and produce a written plan only (no implementation) for: ${b.objective}. Hand-off: a numbered plan with risks, assumptions, and acceptance criteria.`],
    ["EXECUTE", `Using the plan from the previous stage (pasted below as {{PLAN}}), carry out: ${b.objective}. Hand-off: the deliverable plus a change summary.`],
    ["VERIFY", `Independently verify the output of the previous stage ({{STAGE_2_OUTPUT}}) against the acceptance criteria for: ${b.objective}. Hand-off: pass/fail per criterion with evidence and a list of fixes.`],
  ];
  return stages
    .map(([name, obj], i) => `=== PROMPT ${i + 1}/${stages.length} · ${name} ===\n\n${compileOne({ ...b, objective: obj }, fw, clarifications)}`)
    .join("\n\n");
}

function compileOne(b: Brief, fw: Framework, clarifications: Clarification[]): string {
  const agentic = isAgentic(b.target);
  const section = (label: string, body: string) =>
    b.syntax === "xml" ? `<${snake(label)}>\n${body.trim()}\n</${snake(label)}>` : `## ${label.toUpperCase()}\n${body.trim()}`;
  const bullets = (s: string) =>
    s
      .split(/\n|;/)
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean)
      .map((l) => `- ${l}`)
      .join("\n");
  const answered = clarifications.filter((c) => c.answer?.trim());

  const role =
    b.role.trim() ||
    (agentic ? "a principal software engineer and technical architect with deep production experience in the relevant stack" : "a senior domain expert in the subject of this task");
  const ctx = [
    b.context && `Context: ${b.context}`,
    b.inputs && `Inputs available: ${b.inputs}`,
    answered.length ? `Clarified details:\n${answered.map((c) => `- ${c.question} → ${c.answer}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const success = b.successCriteria ? bullets(b.successCriteria) : "- All requirements are met\n- Output is verified, not assumed";
  const rules = [
    rulesText(b),
    agentic && "- Do not modify code unrelated to this task — because unrelated diffs hide regressions in review.",
    agentic && "- Do not add dependencies unless necessary — because each one is permanent maintenance and supply-chain risk.",
    agentic && "- Never expose secrets or weaken auth/security controls — because these failures are unrecoverable.",
    "- Never invent results, sources, or validation outcomes — because unverified claims are worse than gaps.",
    "- Stop and report any blocker that prevents safe completion.",
  ]
    .filter(Boolean)
    .join("\n");
  const steps = (
    agentic
      ? [
          "Inspect the repository, conventions, tests and relevant files before changing anything.",
          "Identify dependencies, risks and affected modules; note assumptions.",
          b.autonomy === "ask-first" ? "Present a bounded plan with acceptance criteria and wait for approval." : "Write a bounded plan with acceptance criteria (track it as a todo list).",
          "Implement the smallest maintainable change that satisfies the plan.",
          "Add or update tests that prove the behaviour.",
          "Run type checks, lint, tests and build; fix failures.",
          "Review the diff for security issues, regressions and unnecessary complexity.",
          "Produce the final report.",
        ]
      : [
          "Restate the objective and what a strong answer must contain.",
          "Reason over the provided context; flag missing information as explicit assumptions.",
          "Draft the deliverable in the required format.",
          "Check the draft against the success criteria and rules; revise.",
          "Return the final output.",
        ]
  )
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
  const deliver = `Deliver: ${b.deliverable || "a complete, production-ready result"}.`;
  const format = b.outputFormat || (agentic ? "Summary of changes, files changed, verification commands with results, assumptions, open issues." : "Return the deliverable only, in a clear structure.");

  const bodies: Record<FrameworkId, [string, string][]> = {
    risen: [
      ["Role", `You are ${role}.`],
      ["Instructions", [`Your task: ${b.objective || "{{OBJECTIVE}}"}`, ctx, `Operating mode: ${AUTONOMY_GUIDANCE[b.autonomy]}`].filter(Boolean).join("\n")],
      ["Steps", steps],
      ["End Goal", `${deliver}\nSuccess criteria:\n${success}`],
      ["Narrowing", rules],
    ],
    costar: [
      ["Context", ctx || "{{CONTEXT}}"],
      ["Objective", `${b.objective || "{{OBJECTIVE}}"}\n${deliver}`],
      ["Style", `Write as ${role}. Precise, concrete, no filler.`],
      ["Tone", b.tone || "Clear, confident, direct."],
      ["Audience", b.audience || "{{AUDIENCE}}"],
      ["Response", `${format}\nSuccess criteria:\n${success}\nRules:\n${rules}`],
    ],
    rtf: [
      ["Role", `You are ${role}.`],
      ["Task", [b.objective || "{{OBJECTIVE}}", ctx, `Success criteria:\n${success}`, `Rules:\n${rules}`].filter(Boolean).join("\n")],
      ["Format", `${deliver}\n${format}`],
    ],
    crispe: [
      ["Capacity and Role", `You are ${role}.`],
      ["Insight", [ctx, b.audience && `Stakeholders / audience: ${b.audience}`].filter(Boolean).join("\n") || "{{CONTEXT}}"],
      ["Statement", `${b.objective || "{{OBJECTIVE}}"}\n${deliver}\nSuccess criteria:\n${success}\nRules:\n${rules}`],
      ["Personality", b.tone || "Direct, opinionated, evidence-led."],
      ["Experiment", b.outputFormat || "Give 3 distinct options. For each: summary, trade-offs, risks. Then recommend one and justify it in two sentences."],
    ],
    bab: [
      ["Before", ctx || "{{CURRENT_STATE}}"],
      ["After", `${b.objective || "{{TARGET_STATE}}"}\nSuccess criteria:\n${success}`],
      ["Bridge", `${steps}\n\n${deliver}\nRules:\n${rules}`],
    ],
  };

  const parts = bodies[fw.id].map(([l, body]) => section(l, body));

  for (const ext of extensionSections(b)) {
    switch (ext.label) {
      case "Examples": {
        const ex = activeExamples(b);
        const body = ex.length
          ? `<examples>\n${ex.map((e) => `<example>\n<input>\n${e.input.trim()}\n</input>\n<output>\n${e.output.trim()}\n</output>\n</example>`).join("\n")}\n</examples>`
          : "<examples>\n<example>{{GOOD_EXAMPLE}}</example>\n<example>{{BAD_EXAMPLE — and why it fails}}</example>\n</examples>";
        parts.push(section(ext.label, body));
        break;
      }
      case "Acceptance Criteria":
        parts.push(section(ext.label, b.successCriteria ? bullets(b.successCriteria).replace(/^- /gm, "- [ ] ") : "- [ ] {{ACCEPTANCE_CRITERIA}}"));
        break;
      case "Authority Boundaries":
        parts.push(
          section(
            ext.label,
            "- Free to change: files directly required by this task and their tests.\n- Requires approval: schema/migration changes, new dependencies, CI/infra config, public API changes.\n- Forbidden: deleting data, force-pushing, rotating secrets, production deploys.",
          ),
        );
        break;
      case "Evidence":
        parts.push(section(ext.label, "Support every completion claim with evidence: command output, test results, file paths, or cited sources. If a check was not run, say so."));
        break;
      case "Self-Critique":
        parts.push(section(ext.label, "Before finalising, review your output against the success criteria and rules. Fix any gap, then finalise."));
        break;
      case "Definition of Done":
        parts.push(section(ext.label, "Done only when every acceptance criterion is met and verification passes — or you have reported exactly which criteria are unmet and why."));
        break;
      case "Output Schema":
        parts.push(section(ext.label, `Respond with valid JSON only, matching this schema exactly:\n\`\`\`json\n${b.outputSchema.trim()}\n\`\`\``));
        break;
      case "Final Report":
        parts.push(section(ext.label, format));
        break;
      case "Assistant Prefill":
        parts.push(section(ext.label, `Send as the start of the assistant turn (not part of the system prompt):\n${b.prefill}`));
        break;
    }
  }
  return parts.join("\n\n");
}
