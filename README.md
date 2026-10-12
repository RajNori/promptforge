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

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · no UI dependencies · any OpenAI-compatible LLM API (streaming) · Vercel

```
app/
  page.tsx               # UI: brief → clarify → forge/refine
  Select.tsx             # accessible themeable listbox
  api/generate/route.ts  # analyze | generate | refine → server-side LLM wrapper (streamed)
lib/
  forge.ts               # frameworks, auto-pick, contracts, validator, offline compiler
```

## Run locally

```bash
npm install
cp .env.example .env.local   # add provider URL, key, model
npm run dev
```

## Environment

| Var | Required | Notes |
|---|---|---|
| `AI_BASE_URL` | yes | OpenAI-compatible base URL (the route calls `/chat/completions`) |
| `AI_API_KEY` | yes | Provider API key |
| `AI_MODEL` | yes | Model id |
| `ACCESS_CODE` | recommended | When set, the API requires this code (the UI prompts for it) |
| `AI_EXTRA_BODY` | no | JSON merged into every upstream request for provider-specific params (e.g. reasoning effort) |
| `AI_FAST_BODY` | no | JSON merged over `AI_EXTRA_BODY` for light calls (analyze, suggest, refine), e.g. reasoning off |

The provider, model and upstream errors stay server-side. The browser only ever talks to `/api/generate`, and clients cannot override the model.

Without a key the app still works in **Instant template** mode.

## License

MIT
