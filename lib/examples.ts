// Curated example briefs — 2–3 variations per task type, spread across targets and frameworks.

import { EMPTY_BRIEF, type Brief } from "./forge";

export type ExampleBrief = { id: string; name: string; brief: Partial<Brief> & Pick<Brief, "taskType" | "target" | "objective"> };

const r = (rule: string, why: string) => ({ rule, why });

export const EXAMPLES: ExampleBrief[] = [
  // ── Build a feature
  {
    id: "stripe-subs",
    name: "Stripe subscriptions",
    brief: {
      taskType: "Build a feature",
      target: "claude-code",
      objective: "Add Stripe Checkout subscriptions (monthly + annual) to our SaaS with webhook-driven entitlement updates.",
      context: "Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS + Auth), deployed on Vercel. Users table exists; no billing yet.",
      inputs: "Stripe test keys in .env.local, price IDs for both plans, existing /settings page.",
      deliverable: "Checkout flow, webhook handler, entitlements table + RLS, billing section in /settings.",
      successCriteria:
        "Test-mode purchase upgrades the user within 5s via webhook\nCancelling in the Stripe portal downgrades at period end\nWebhook is idempotent and signature-verified\nAll tests, typecheck and build pass",
      rules: [
        r("Never trust plan state from the client", "entitlements must be server-authoritative or users can self-upgrade"),
        r("No new UI libraries", "bundle budget and design-system consistency"),
        r("Do not touch auth flows", "out of scope and high blast radius"),
      ],
    },
  },
  {
    id: "presence",
    name: "Realtime presence avatars",
    brief: {
      taskType: "Build a feature",
      target: "cursor",
      objective: "Show live 'who's viewing' avatars on document pages using Supabase Realtime presence.",
      context: "React 19 + Vite SPA, Supabase client already initialised in src/lib/supabase.ts. Docs live at /doc/:id.",
      deliverable: "usePresence hook, AvatarStack component, wired into DocHeader.",
      successCriteria: "Second browser tab appears within 2s\nLeaving the page removes the avatar within 10s\nMax 5 avatars then '+N'",
      rules: [r("Keep changes inside src/features/presence and DocHeader.tsx", "other teams own the rest of src/"), r("No polling", "it multiplies DB load per open tab")],
      autonomy: "bounded",
      depth: "lean",
    },
  },
  {
    id: "invoice-pipeline",
    name: "Invoice ingestion pipeline (multi-agent)",
    brief: {
      taskType: "Build a feature",
      target: "multi-agent",
      objective: "Build a pipeline that ingests supplier PDF invoices from an inbox, extracts line items, matches them to purchase orders, and flags mismatches.",
      context: "Python 3.12, FastAPI, Postgres. ~400 invoices/month, 30 suppliers, mixed scanned and digital PDFs.",
      deliverable: "Orchestrator + extractor + matcher + reviewer agents, with a mismatch report endpoint.",
      successCriteria: "≥ 95% line-item extraction accuracy on the 50-invoice fixture set\nEvery mismatch has a reason code\nNo invoice is auto-approved",
      rules: [r("Never auto-approve payments", "finance requires a human sign-off by policy"), r("Store raw PDFs immutably", "audit trail for disputes")],
      chain: true,
      extensions: { ...EMPTY_BRIEF.extensions, selfCritique: true },
    },
  },

  // ── Fix a bug
  {
    id: "double-charge",
    name: "Intermittent double charge",
    brief: {
      taskType: "Fix a bug",
      target: "claude-code",
      objective: "Find and fix the cause of occasional double charges when users retry a failed checkout.",
      context: "Node 22 + Express payments service, Stripe PaymentIntents, Redis for sessions. ~0.3% of retries double-charge; started after last week's retry-button release.",
      inputs: "Sentry issue PAY-1182, logs for 6 affected orders in /tmp/incident, src/payments/*.ts",
      deliverable: "Root-cause write-up, minimal fix, regression test that reproduces the race.",
      successCriteria: "Regression test fails before the fix and passes after\nIdempotency key used on every PaymentIntent create\nNo change to the public API",
      rules: [r("Reproduce before fixing", "a fix without a repro can't be trusted"), r("Do not refund or touch live Stripe data", "finance handles remediation separately")],
      autonomy: "ask-first",
    },
  },
  {
    id: "ios-crash",
    name: "iOS cold-start crash",
    brief: {
      taskType: "Fix a bug",
      target: "codex",
      objective: "Fix the crash on cold start affecting users on the latest iOS release.",
      context: "SwiftUI app, iOS 17+ deployment target, Core Data + CloudKit sync. Crash rate jumped from 0.1% to 4% after the OS update; only on cold start.",
      inputs: "Crash logs in /crashes (symbolicated), AppDelegate.swift, PersistenceController.swift",
      deliverable: "Fix, a unit/UI test covering the launch path, and a short changelog entry.",
      successCriteria: "App launches cleanly on the latest iOS simulator 20/20 times\nNo Core Data migration changes\nCI green",
      rules: [r("Do not bump the deployment target", "we still support older iOS versions")],
      autonomy: "autonomous",
    },
  },

  // ── Refactor / migrate
  {
    id: "express-next",
    name: "Express → Next.js route handlers (chain)",
    brief: {
      taskType: "Refactor / migrate",
      target: "claude-code",
      objective: "Migrate our Express API to Next.js App Router route handlers without changing any API contract.",
      context: "Express 4, 40 routes, Jest + supertest suite, JWT auth middleware, deployed on a single VM today.",
      deliverable: "Route handlers under app/api, shared middleware equivalents, migrated tests.",
      successCriteria: "All existing tests pass against the new handlers\nRequest/response shapes byte-identical on the 10 golden fixtures\nNo route left on Express",
      rules: [r("Keep URL paths and status codes identical", "mobile clients are pinned to old versions"), r("Migrate in route groups, one commit each", "keeps review and rollback small")],
      chain: true,
    },
  },
  {
    id: "jquery-react",
    name: "jQuery checkout → React (chat)",
    brief: {
      taskType: "Refactor / migrate",
      target: "chat-llm",
      objective: "Plan the rewrite of our legacy jQuery checkout into React components with a safe incremental rollout.",
      context: "3,000 lines of jQuery across 6 files, global state on window, server-rendered PHP templates. Conversion rate must not drop.",
      deliverable: "Component breakdown, migration sequence, feature-flag strategy, risk list.",
      successCriteria: "Every step is shippable on its own\nRollback path for each step\nNo big-bang release",
      rules: [r("Assume both versions run side by side for weeks", "we roll out by traffic percentage")],
    },
  },

  // ── Architecture / design
  {
    id: "multitenant",
    name: "Multi-tenant data isolation",
    brief: {
      taskType: "Architecture / design",
      target: "chat-llm",
      objective: "Recommend a tenant-isolation model for our B2B SaaS moving from single-tenant to multi-tenant.",
      context: "Postgres 16, ~200 customers, 3 enterprise customers need data residency, SOC 2 in progress. Team of 6 engineers.",
      deliverable: "Comparison of shared-schema + RLS vs schema-per-tenant vs DB-per-tenant, recommendation, migration outline.",
      successCriteria: "Covers cost, ops load, noisy-neighbour and residency\nClear single recommendation\nMigration steps are reversible",
      rules: [r("Prefer managed services over self-hosted", "no dedicated ops engineer")],
      outputFormat: "Markdown: TL;DR, comparison table, recommendation, migration phases, risks. Max 700 words.",
    },
  },
  {
    id: "notifications-adr",
    name: "Notifications service ADR",
    brief: {
      taskType: "Architecture / design",
      target: "claude-code",
      objective: "Design an event-driven notifications service (email, push, in-app) and write it up as an ADR in the repo.",
      context: "Monorepo, TypeScript services, AWS (SQS, Lambda, DynamoDB). Notifications currently sent inline from 9 services.",
      deliverable: "docs/adr/0012-notifications.md plus a sequence diagram in Mermaid.",
      successCriteria: "Covers retries, dedupe, user preferences and quiet hours\nLists the 9 call sites to migrate\nAlternatives considered with trade-offs",
      rules: [r("Do not write implementation code yet", "the ADR must be approved first")],
      autonomy: "ask-first",
    },
  },

  // ── Code review / audit
  {
    id: "auth-audit",
    name: "Auth & session security audit",
    brief: {
      taskType: "Code review / audit",
      target: "claude-code",
      objective: "Audit authentication and session handling for vulnerabilities and report findings by severity.",
      context: "Next.js 16, NextAuth, Postgres, custom API keys for integrations. Pen test scheduled in 3 weeks.",
      deliverable: "Findings report with file:line, severity, exploit scenario and fix for each.",
      successCriteria: "Covers session fixation, CSRF, token storage, API key hashing, rate limiting\nEvery finding has evidence from the code\nNo false 'all clear' claims",
      rules: [r("Read-only — do not change code", "fixes go through separate reviewed PRs"), r("Never print secrets found in the repo", "report the file path instead")],
      autonomy: "bounded",
      extensions: { ...EMPTY_BRIEF.extensions, selfCritique: true },
    },
  },
  {
    id: "perf-review",
    name: "PR performance review",
    brief: {
      taskType: "Code review / audit",
      target: "cursor",
      objective: "Review the open PR for performance regressions in list rendering and data fetching.",
      context: "React 19 dashboard; PR adds filtering to a 5k-row table and a new useOrders hook.",
      deliverable: "Inline review comments plus a summary of the top 3 issues with suggested diffs.",
      successCriteria: "Flags unnecessary re-renders and N+1 fetches\nEach issue has a concrete fix\nNo style nitpicks",
      rules: [r("Comment only, don't push commits", "the author owns the PR")],
      depth: "lean",
    },
  },

  // ── Research & analysis
  {
    id: "vector-db",
    name: "Vector DB comparison",
    brief: {
      taskType: "Research & analysis",
      target: "chat-llm",
      objective: "Compare vector databases for 50M embeddings with metadata filtering and recommend one.",
      context: "1536-dim embeddings, 200 QPS peak, p95 < 100ms, already on AWS, small platform team.",
      deliverable: "Comparison of pgvector, Pinecone, Qdrant and OpenSearch with a recommendation.",
      successCriteria: "Covers cost at 50M vectors, filtering, ops burden, lock-in\nStates assumptions behind any number",
      rules: [r("Flag anything that may be outdated", "pricing and features change fast")],
      outputFormat: "Table (rows: options, cols: cost, latency, filtering, ops, lock-in) then a 3-sentence recommendation.",
    },
  },
  {
    id: "pii-map",
    name: "PII data-flow map (agent)",
    brief: {
      taskType: "Research & analysis",
      target: "claude-code",
      objective: "Map every place personal data (email, phone, address, DOB) is collected, stored, logged or sent to third parties.",
      context: "Django monolith + Celery workers, Segment and Sentry integrations. Preparing a privacy impact assessment.",
      deliverable: "PII inventory table (field, source, storage, retention, processors) plus a list of risky flows.",
      successCriteria: "Every model field with PII listed with file:line\nAll third-party SDK calls checked\nLogging of PII flagged",
      rules: [r("Read-only", "this is discovery, not remediation")],
    },
  },

  // ── Writing / content
  {
    id: "launch-post",
    name: "LinkedIn launch post",
    brief: {
      taskType: "Writing / content",
      target: "chat-llm",
      objective: "Write a LinkedIn post announcing our new CSV export feature.",
      context: "B2B analytics tool for operations teams. CSV export was the #1 requested feature last quarter.",
      deliverable: "One post under 180 words with a hook first line.",
      successCriteria: "Hook in first line\nOne concrete customer benefit\nEnds with a soft CTA",
      rules: [r("No hype words (revolutionary, game-changing)", "our buyers are skeptical engineers")],
      audience: "Ops leads at 50–500 person companies",
      tone: "Plain, confident, a little dry",
      depth: "lean",
    },
  },
  {
    id: "incident-email",
    name: "Incident customer email",
    brief: {
      taskType: "Writing / content",
      target: "chat-llm",
      objective: "Write the customer email for yesterday's 47-minute outage of scheduled reports.",
      context: "Root cause: expired TLS cert on the report renderer. Reports delayed, no data lost. Monitoring for cert expiry now added.",
      deliverable: "Email with subject line, under 200 words.",
      successCriteria: "Says what happened, impact, fix, prevention\nNo blame on vendors\nApology is specific, not generic",
      rules: [r("No jargon like 'TLS' without a plain explanation", "readers are finance managers")],
      audience: "Finance managers who rely on Monday-morning reports",
      tone: "Accountable, calm, specific",
    },
  },
  {
    id: "edge-blog",
    name: "Technical blog post",
    brief: {
      taskType: "Writing / content",
      target: "chat-llm",
      objective: "Write a technical blog post on how we cut API latency 60% by moving auth checks to edge middleware.",
      context: "Before: p95 420ms. After: p95 170ms. Moved JWT verification and geo-routing to edge; kept DB calls in region.",
      deliverable: "1,200–1,500 word post with code snippets and a before/after chart description.",
      successCriteria: "Includes the trade-offs we hit (cold starts, bundle limits)\nCode is copy-pasteable\nNumbers match the context",
      audience: "Senior engineers evaluating edge runtimes",
      tone: "Practical, candid about failures, no marketing",
      depth: "exhaustive",
    },
  },

  // ── Data / reporting
  {
    id: "kpi-summary",
    name: "Weekly KPI summary",
    brief: {
      taskType: "Data / reporting",
      target: "chat-llm",
      objective: "Turn this week's KPI CSV into an executive summary with the three things leadership should act on.",
      context: "CSV columns: week, signups, activation_rate, MRR, churn, NPS. 12 weeks of history included.",
      deliverable: "Summary with trends, anomalies and three actions.",
      successCriteria: "Every claim references a number from the CSV\nWeek-over-week and 4-week trend for each KPI\nThree actions ranked by impact",
      rules: [r("Don't speculate about causes without flagging it", "leadership acts on this")],
      outputFormat: "TL;DR (2 lines), KPI table with WoW %, anomalies, 3 actions. Max 300 words.",
    },
  },
  {
    id: "receipt-json",
    name: "Receipt → JSON extractor (API)",
    brief: {
      taskType: "Data / reporting",
      target: "api-system",
      objective: "Extract merchant, date, currency, line items and totals from receipt OCR text into strict JSON.",
      context: "OCR text from phone photos; messy line breaks; AUD by default; some receipts include GST lines.",
      deliverable: "System prompt for the extraction endpoint.",
      successCriteria: "Output always validates against the schema\nTotals reconcile with line items or flag mismatch\nUnknown fields are null, never guessed",
      rules: [r("Never invent values", "downstream accounting trusts nulls more than guesses")],
      prefill: '{"merchant":',
      outputSchema:
        '{"type":"object","properties":{"merchant":{"type":["string","null"]},"date":{"type":["string","null"],"format":"date"},"currency":{"type":"string"},"items":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"qty":{"type":"number"},"price":{"type":"number"}}}},"total":{"type":["number","null"]},"mismatch":{"type":"boolean"}},"required":["merchant","date","currency","items","total","mismatch"]}',
      examples: [{ input: "WOOLWORTHS 12/03/26\nMILK 2L 1 x 3.10\nBREAD 1 x 4.50\nTOTAL 7.60", output: '{"merchant":"Woolworths","date":"2026-03-12","currency":"AUD","items":[{"name":"Milk 2L","qty":1,"price":3.1},{"name":"Bread","qty":1,"price":4.5}],"total":7.6,"mismatch":false}' }],
    },
  },

  // ── Product / strategy
  {
    id: "pricing",
    name: "Pricing model options",
    brief: {
      taskType: "Product / strategy",
      target: "chat-llm",
      objective: "Propose pricing models for our B2B scheduling tool as we move off a single flat plan.",
      context: "$49/mo flat today, 900 customers, heavy users are 10% of accounts and 60% of usage. Competitors price per seat.",
      deliverable: "Three pricing options with modelled revenue impact and a recommendation.",
      successCriteria: "Each option shows impact on the top 10% and the bottom 50%\nMigration plan for existing customers\nRisks named",
      rules: [r("No price rise above 30% for any existing customer in year one", "churn risk on annual renewals")],
      audience: "CEO and head of sales",
      tone: "Analytical, decisive",
    },
  },
  {
    id: "roadmap",
    name: "Q1 roadmap prioritisation",
    brief: {
      taskType: "Product / strategy",
      target: "chat-llm",
      objective: "Prioritise 12 candidate features into a Q1 roadmap for a 5-engineer team.",
      context: "Goal for Q1: reduce churn from 4% to 3% monthly. Feature list with rough effort and request counts pasted below.",
      deliverable: "Now / Next / Later roadmap with rationale and what we're explicitly not doing.",
      successCriteria: "Every 'Now' item ties to the churn goal\nFits 5 engineers × 12 weeks\nCut list is explicit",
      audience: "Product and engineering leads",
      tone: "Direct, opinionated, evidence-led",
      outputFormat: "Score table (impact, effort, confidence), then Now/Next/Later, then 'not doing'.",
    },
  },

  // ── Other
  {
    id: "support-triage",
    name: "Support triage bot (API)",
    brief: {
      taskType: "Other",
      target: "api-system",
      objective: "Classify incoming support tickets by urgency and product area and draft a first reply.",
      context: "SaaS with 4 areas: billing, auth, integrations, reporting. Urgent = data loss, security, or all users blocked.",
      deliverable: "System prompt for the triage endpoint.",
      successCriteria: "Urgency is always one of low/normal/high\nDraft reply under 80 words\nSecurity tickets never get an auto-reply",
      rules: [r("Never promise timelines or refunds", "support policy requires a human for commitments")],
      prefill: '{"urgency":',
      outputSchema:
        '{"type":"object","properties":{"urgency":{"enum":["low","normal","high"]},"area":{"enum":["billing","auth","integrations","reporting","other"]},"reply":{"type":["string","null"]}},"required":["urgency","area","reply"]}',
    },
  },
  {
    id: "interview-bank",
    name: "Interview question bank",
    brief: {
      taskType: "Other",
      target: "chat-llm",
      objective: "Create an interview question bank for senior frontend engineers with scoring rubrics.",
      context: "React/TypeScript product team. Loop: 45-min technical, 60-min system design, 30-min values.",
      deliverable: "15 questions across the three interviews, each with what a strong vs weak answer looks like.",
      successCriteria: "No trivia questions\nEach question maps to a competency\nRubric distinguishes senior from mid-level",
      rules: [r("No questions answerable by recalling an API", "we hire for judgement, not memory")],
      outputFormat: "Grouped by interview; per question: question, competency, strong signals, red flags.",
    },
  },
];

export function exampleBrief(ex: ExampleBrief): Brief {
  return {
    ...EMPTY_BRIEF,
    ...ex.brief,
    rules: ex.brief.rules?.length ? ex.brief.rules : [{ rule: "", why: "" }],
    extensions: { ...EMPTY_BRIEF.extensions, ...(ex.brief.extensions ?? {}) },
  };
}
