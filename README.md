# Prompt Forge

One brief → production-grade prompts in **RISEN, CO-STAR, RTF, CRISPE, or BAB**.
The model analyses the brief, asks targeted gap questions, generates against a hard section contract, validates the result, and lets you fine-tune with plain-English feedback.

**Live:** https://risen-forge.vercel.app

## Features

- **Framework registry with auto-pick.** Inferred from task type and target (Writing → CO-STAR, Strategy → CRISPE, chat refactor → BAB, chat research/data → RTF, else RISEN). Can be overridden.
- **Clarify step.** The model scores brief completeness and asks up to 4 high-leverage questions.
- **Rules with reasons.** Each constraint carries a "because…", which models follow far more reliably than bare rules.
- **Few-shot slots.** Up to 3 input→output pairs, rendered verbatim as `<example>` blocks.
- **Chain mode.** Produces 2–4 sequenced prompts with explicit hand-off contracts instead of one mega-prompt.
- **API target extras.** Assistant prefill and a JSON output schema.
- **Agentic extensions.** Acceptance criteria, evidence gates, authority boundaries, Definition of Done, and self-critique.
- **Contract validation.** Required headings are checked after generation, with one automatic repair pass if any are missing.
- **Offline template mode.** Deterministic output for every framework with no API call.
- **Light/dark/system themes.** Accessible custom dropdown and version history (v1, v2…), with `.md` export.

## Accounts, plans & data

- **Auth:** Auth.js v5 (Google / GitHub) with the Prisma adapter; providers turn on when their env vars exist.
- **Database:** Prisma 7 + Postgres (Vercel Prisma Postgres). Migrations run automatically at build when `DATABASE_URL` is set; without it the app runs in guest-only mode.
- **Plans** (`lib/plans.ts`): Guest 3 AI generations/day · Free 30/month · Pro 1,000/month. Autofill and analysis are free (burst-limited). `ADMIN_EMAILS` get Pro.
- **History:** last 5 versions per prompt plus up to 10 pinned; auto-fixes replace the attempt they fix. Synced for signed-in users, in the browser for guests.

## Security model

The server is the security boundary; client-side checks are UX only.

| Layer | Control |
|---|---|
| Request | Zod schema on every body, unknown keys dropped, per-field length caps, 120 KB body cap, same-origin check |
| Text hygiene | NFKC normalisation; zero-width, bidi-override, Unicode tag and control characters stripped (client + server) |
| Prompt injection | Security preamble with highest priority; all user content wrapped in `<untrusted_*>` tags; spoofed delimiter/system tags defanged; suspicious phrasing logged |
| Output | Per-request canary detects system-prompt leaks (output discarded); off-task output (no framework sections) discarded; JSON outputs re-sanitised |
| Abuse / cost | DB-backed burst limits and plan quotas per user or hashed IP; free auto-repairs capped relative to paid calls; provider details never exposed |
| Data | Ownership checked on every project/version route; raw IPs never stored |
| Headers | CSP, `X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions policy |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · Auth.js v5 · Zod · any OpenAI-compatible LLM API · Vercel

```
app/
  page.tsx                     # brief → clarify → forge/refine
  Account.tsx, useHistory.ts   # account bar, library, versions
  api/generate/route.ts        # analyze | generate | refine | suggest (guarded, metered, streamed)
  api/me, api/projects/**      # account + saved prompts/versions
  pricing, signin, terms, privacy
lib/
  forge.ts                     # frameworks, contracts, validator, offline compiler
  server/{db,account,guard,metering,projects}.ts
prisma/schema.prisma           # User/Account/Session, Project, Version, UsageEvent
```

## Run locally

```bash
npm install
cp .env.example .env.local     # AI provider, DATABASE_URL, AUTH_* vars
npx prisma migrate deploy
npm run dev
```

## Environment

See `.env.example` for every variable with notes.

## License

MIT
