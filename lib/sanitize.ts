// Shared (client + server) text hygiene. The client applies it for UX; the server re-applies it as the real control.

// Zero-width, bidi-override and other invisible characters used to smuggle hidden instructions.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁯﻿­᠎]/g;
// C0/C1 control chars except tab, newline, carriage return.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Unicode "tag" characters (U+E0000–E007F) — invisible ASCII mirrors used in prompt smuggling.
const TAGS = /[\u{E0000}-\u{E007F}]/gu;

export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.normalize("NFKC").replace(TAGS, "").replace(INVISIBLE, "").replace(CONTROL, "").replace(/\r\n?/g, "\n").slice(0, max);
}

/** Field length limits — enforced by the server schema and mirrored as `maxLength` in the UI. */
export const LIMITS = {
  short: 300, // role, audience, tone
  objective: 2000,
  context: 4000,
  medium: 2000, // inputs, deliverable, success criteria, output format
  rule: 300,
  rules: 12,
  example: 3000,
  examples: 3,
  prefill: 500,
  schema: 4000,
  prompt: 30000,
  feedback: 1000,
  answer: 500,
  clarifications: 6,
} as const;
