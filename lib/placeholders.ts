// Field placeholders that follow what the user is doing right now (task type),
// flavoured by who they are (persona) when they're on their persona's home task.

import { PERSONA_TASK, persona as personaOf, type PersonaId } from "./personas";

export type PhField =
  | "role"
  | "objective"
  | "context"
  | "contextHint"
  | "audience"
  | "tone"
  | "deliverable"
  | "successCriteria"
  | "rule"
  | "why"
  | "inputs"
  | "outputFormat";

type Ph = Record<PhField, string>;

const BY_TASK: Record<string, Ph> = {
  "Build a feature": {
    role: "Principal engineer, Next.js + Supabase",
    objective: "Add team invites: owners can invite teammates by email and set their role…",
    context: "Next.js 16, TypeScript, Supabase RLS, Vercel. Auth exists; single-user accounts today…",
    contextHint: "stack, codebase, constraints",
    audience: "Reviewers on the core team",
    tone: "Precise, terse",
    deliverable: "PR-ready feature with tests and migration",
    successCriteria: "Tests pass\nRLS blocks cross-team access\nNo new dependencies",
    rule: "No new dependencies",
    why: "bundle budget (optional)",
    inputs: "Repo, schema.sql, design mock",
    outputFormat: "Summary of changes, files touched, how to verify",
  },
  "Fix a bug": {
    role: "Senior engineer who debugs by evidence",
    objective: "Fix checkout failing with 500 for users with saved cards…",
    context: "Started after Tuesday's deploy. Stack trace and repro steps below…",
    contextHint: "symptoms, repro, logs, recent changes",
    audience: "On-call team",
    tone: "Factual, concise",
    deliverable: "Root cause, minimal fix, regression test",
    successCriteria: "Repro test fails before, passes after\nNo unrelated changes",
    rule: "Reproduce before fixing",
    why: "avoids fixing the wrong thing (optional)",
    inputs: "Stack trace, logs, failing request",
    outputFormat: "Root cause → fix → test → risk",
  },
  "Refactor / migrate": {
    role: "Staff engineer, migrations specialist",
    objective: "Migrate the API from Express to Fastify without changing behaviour…",
    context: "40 routes, Jest suite with 80% coverage, deployed on ECS…",
    contextHint: "current state, target state, constraints",
    audience: "Engineering team",
    tone: "Methodical",
    deliverable: "Incremental migration plan and PRs",
    successCriteria: "All existing tests pass\nNo API contract changes\nRollback per step",
    rule: "Behaviour must not change",
    why: "clients depend on current contracts (optional)",
    inputs: "Repo, OpenAPI spec",
    outputFormat: "Step plan with checkpoints",
  },
  "Architecture / design": {
    role: "Principal architect",
    objective: "Design the notification system for email, push and in-app at 1M users…",
    context: "Postgres + Redis on AWS, 3 engineers, 6-week deadline…",
    contextHint: "scale, stack, team, constraints",
    audience: "CTO and tech leads",
    tone: "Opinionated, trade-off driven",
    deliverable: "Design doc with options, decision and diagram",
    successCriteria: "Compares 2–3 options\nNames failure modes\nClear recommendation",
    rule: "Prefer managed services",
    why: "small team, no ops capacity (optional)",
    inputs: "Current architecture, traffic numbers",
    outputFormat: "ADR format",
  },
  "Code review / audit": {
    role: "Security-minded senior reviewer",
    objective: "Review this PR for correctness, security and performance…",
    context: "Payment webhook handler, Node + Stripe. Diff pasted below…",
    contextHint: "what changed, risk areas",
    audience: "PR author",
    tone: "Direct, constructive",
    deliverable: "Findings ranked by severity with fixes",
    successCriteria: "Each finding has file:line and a fix\nNo style nitpicks",
    rule: "Only report verified issues",
    why: "noise wastes reviewer time (optional)",
    inputs: "Diff, related files",
    outputFormat: "Table: severity, location, issue, fix",
  },
  "Research & analysis": {
    role: "Senior research analyst",
    objective: "Summarise these 12 interview transcripts into key themes…",
    context: "Research question, scope, and the decision this informs…",
    contextHint: "question, sources, decision it informs",
    audience: "Leadership team",
    tone: "Neutral, evidence-led",
    deliverable: "Ranked findings with evidence and recommendations",
    successCriteria: "Every claim cites a source\nSeparates fact from interpretation",
    rule: "Never invent sources or quotes",
    why: "findings must be verifiable (optional)",
    inputs: "Transcripts, reports, links",
    outputFormat: "TL;DR, findings, evidence, next steps",
  },
  "Writing / content": {
    role: "Experienced editor and copywriter",
    objective: "Write a 1,200-word blog post on how to choose a wedding photographer…",
    context: "Who it's for, key points, examples, what's worked before…",
    contextHint: "topic, key points, background",
    audience: "Couples planning a wedding",
    tone: "Warm, expert, honest",
    deliverable: "1,200-word post with headline and subheads",
    successCriteria: "Hook in the first line\nOne clear takeaway\nNo clichés",
    rule: "No made-up statistics",
    why: "credibility (optional)",
    inputs: "Notes, outline, source links",
    outputFormat: "Headline, body with H2s, meta description",
  },
  "Data / reporting": {
    role: "Data analyst fluent in SQL and Python",
    objective: "Analyse monthly sales and explain what's driving the Q3 decline…",
    context: "Columns, date range, data source, known caveats…",
    contextHint: "dataset, columns, question",
    audience: "Finance and ops leads",
    tone: "Clear, numbers-first",
    deliverable: "Findings with numbers, charts to make, next analyses",
    successCriteria: "Every claim cites a number\nCorrelation vs causation flagged",
    rule: "Show calculations",
    why: "results must be reproducible (optional)",
    inputs: "CSV, schema, previous report",
    outputFormat: "Summary table + bullet insights",
  },
  "Product / strategy": {
    role: "Seasoned product strategist",
    objective: "Decide whether to raise prices 20% or launch a premium tier…",
    context: "Customers, metrics, competitors, constraints…",
    contextHint: "situation, metrics, constraints",
    audience: "Founders and board",
    tone: "Analytical, decisive",
    deliverable: "Options compared with a recommendation",
    successCriteria: "Assumptions explicit\nReversible first step\nClear recommendation",
    rule: "State assumptions explicitly",
    why: "decision quality depends on them (optional)",
    inputs: "Metrics, customer feedback, competitor pricing",
    outputFormat: "One-page decision memo",
  },
  "Email / message": {
    role: "Executive assistant with a great ear for tone",
    objective: "Draft an email declining a meeting and offering an alternative…",
    context: "Who it's from and to, your relationship, what happened, deadlines…",
    contextHint: "sender, recipient, situation",
    audience: "Senior client contact",
    tone: "Professional, warm, concise",
    deliverable: "Ready-to-send email with subject line, under 150 words",
    successCriteria: "Clear ask or answer in the first 2 lines\nOne call to action",
    rule: "No blame",
    why: "keeps the relationship intact (optional)",
    inputs: "The email thread",
    outputFormat: "Subject + body",
  },
  "Marketing & ads": {
    role: "Performance marketer and copywriter",
    objective: "Write 3 Facebook ad variations for our winter sale…",
    context: "Brand, product, offer, channel, what's worked before…",
    contextHint: "brand, offer, channel, past results",
    audience: "Busy parents in Melbourne, price-conscious",
    tone: "Warm, punchy, no hype",
    deliverable: "3 ad variants with headline, body, CTA",
    successCriteria: "Each variant tests a different hook\nWithin platform character limits",
    rule: "No unverifiable claims",
    why: "advertising standards (optional)",
    inputs: "Brand guide, past top ads",
    outputFormat: "Table: hook, headline, body, CTA",
  },
  "Study & learning": {
    role: "Patient tutor who explains with analogies",
    objective: "Explain photosynthesis so I can answer exam questions on it…",
    context: "Course, level, what you already know, how you'll be assessed…",
    contextHint: "course, level, what you know",
    audience: "Me — first-year uni student",
    tone: "Clear, encouraging",
    deliverable: "Study notes + 10 practice questions with answers",
    successCriteria: "Builds from basics\nQuestions get harder\nAnswers explain why",
    rule: "Don't write my assignment for me",
    why: "academic integrity (optional)",
    inputs: "Lecture notes, syllabus",
    outputFormat: "Notes, then quiz, then answers",
  },
  "Planning & admin": {
    role: "Organised chief of staff",
    objective: "Create an agenda for a 90-minute leadership offsite session…",
    context: "Who's involved, timing, constraints, decisions needed…",
    contextHint: "people, timing, constraints",
    audience: "Leadership team",
    tone: "Clear, structured",
    deliverable: "Timed plan with owners and outcomes",
    successCriteria: "Fits the time available\nEvery item has an owner",
    rule: "Leave buffer time",
    why: "things always run over (optional)",
    inputs: "Calendar, notes, previous agenda",
    outputFormat: "Table: time, item, owner, outcome",
  },
  Other: {
    role: "Thoughtful expert in the topic",
    objective: "Help me plan a 5-day family trip to Tasmania…",
    context: "Background, preferences, constraints, budget…",
    contextHint: "background, preferences, constraints",
    audience: "Me",
    tone: "Friendly, practical",
    deliverable: "Clear plan or answer I can act on",
    successCriteria: "Specific, not generic\nFits my constraints",
    rule: "Ask if something's unclear",
    why: "avoids wrong assumptions (optional)",
    inputs: "Anything relevant",
    outputFormat: "Short sections with bullets",
  },
};

/** Placeholder for a field: persona flavour on the persona's home task, otherwise the task type's own. */
export function placeholderFor(field: PhField, taskType: string, p: PersonaId | null | undefined): string {
  if (p && PERSONA_TASK[p] === taskType) {
    const own = personaOf(p).placeholders[field as keyof ReturnType<typeof personaOf>["placeholders"]];
    if (own) return own;
  }
  return (BY_TASK[taskType] ?? BY_TASK.Other)[field];
}

export const PLACEHOLDER_TASKS = Object.keys(BY_TASK);
