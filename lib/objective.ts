/**
 * Cheap, deliberately loose check for objectives that are clearly not a task (keyboard mash, random
 * characters, no letters). Runs in the browser before any AI call and again on the server before metering.
 * It only catches the obvious cases; the model is the real judge (UNCLEAR_MARKER below). Anything in a
 * non-Latin script, any recognisable word, and jargon/acronyms pass, so real objectives are never blocked here.
 */

export const UNCLEAR_OBJECTIVE_MSG = "We couldn't tell what you want from that objective. Describe the task in a sentence.";
export const OBJECTIVE_EXAMPLE = "e.g. Write a friendly email inviting my team to Friday's product demo.";

/** The model answers with exactly this line (generate) or {"unclear": true} (analyze) when the brief has no discernible task. */
export const UNCLEAR_MARKER = "UNCLEAR_OBJECTIVE";

const VOWELS = /[aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿœ]/i;

/** A Latin-letter token that no language would produce: long consonant runs, a repeated letter, or a long vowel-starved string. */
function mashed(token: string): boolean {
  const t = token.toLowerCase();
  if (/(.)\1{3,}/.test(t)) return true; // "aaaa", "kkkkk"
  if (/[^aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿœ]{6,}/.test(t)) return true; // "sjfljsdlkfjs" (real words top out around 5: "ngths")
  if (t.length >= 18) {
    const v = [...t].filter((c) => VOWELS.test(c)).length;
    if (v / t.length < 0.25) return true;
  }
  return false;
}

/** True when the objective is clearly not a task. Loose on purpose: when in doubt, let it through. */
export function isGibberishObjective(raw: string): boolean {
  const text = raw.normalize("NFC").trim();
  if (!text) return false; // "required" is handled elsewhere
  // No letters in any script at all (e.g. "12345 !!!", "????").
  if (!/\p{L}/u.test(text)) return true;
  // Any non-Latin script (CJK, Cyrillic, Arabic, Devanagari…) — we can't judge it cheaply, so trust it.
  if (/[^\p{Script=Latin}\P{L}]/u.test(text)) return false;
  const tokens = text.match(/\p{L}+/gu) ?? [];
  // Short tokens are acronyms, units, abbreviations ("Q3", "SQL", "a", "to") — never judged on their own.
  const judged = tokens.filter((t) => t.length >= 4);
  if (!judged.length) return tokens.join("").length < 3; // "x", "ok?" — too little to be a task
  // Block only if every substantial token looks like keyboard mash; one real word lets it through.
  return judged.every(mashed);
}
