/**
 * Cheap check for objectives that are clearly not a task (keyboard mash, random characters, no letters).
 * Runs in the browser before any AI call and again on the server before metering. The model is the
 * second line (UNCLEAR_MARKER below). Non-Latin scripts always pass, and so does any text containing a
 * common word, so real objectives (including terse, jargon-heavy or non-English ones) aren't blocked here.
 */

export const UNCLEAR_OBJECTIVE_MSG = "We couldn't tell what you want from that objective. Describe the task in a sentence.";
export const OBJECTIVE_EXAMPLE = "e.g. Write a friendly email inviting my team to Friday's product demo.";

/** The model answers with exactly this line (generate) or {"understood": false} (analyze) when the brief has no discernible task. */
export const UNCLEAR_MARKER = "UNCLEAR_OBJECTIVE";

const V = "aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿœ";
const VOWEL = new RegExp(`[${V}]`, "i");
const CONSONANT_RUN = new RegExp(`[^${V}]{5,}`, "i");
// Letter groups that make one sound, removed before counting consonant runs ("strengths", "Rechtsschutz").
const DIGRAPHS = /sch|tch|ch|sh|th|ph|gh|ng|ck|wh|rh|sz|cz|rz|dz|ß|([^aeiouy])\1/g;

// Common words in English and the main Latin-script languages. One of these anywhere means it's language.
const COMMON = new Set(
  (
    "a an the to for of in on at by with from and or but not no is are be was it its this that these my me i we our you your " +
    "he she they them his her their what how why who when where which can could should would will do does make help write " +
    "create build plan draft fix find get give tell explain summarise summarize list improve review analyse analyze about into " +
    "email letter post blog report essay story plan trip code app page website team customer client job work school " +
    "le la les un une des du de et en pour avec dans sur est je tu il nous vous mon ma mes " +
    "el los las una unos y para con por es que mi mis su " +
    "der die das ein eine und für mit von zu ist ich mein meine " +
    "il lo gli uno per con che è io " +
    "o os um uma e com por em eu meu minha " +
    "het een en voor met van ik mijn"
  ).split(" "),
);

// Runs of 4+ adjacent keys on a QWERTY row (either direction): "asdf", "hjkl", "poiu".
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function keyboardRun(t: string): boolean {
  for (const row of ROWS)
    for (const r of [row, [...row].reverse().join("")])
      for (let i = 0; i + 4 <= r.length; i++) if (t.includes(r.slice(i, i + 4))) return true;
  return false;
}

// Letter pairs that essentially never occur inside real words in Latin-script languages.
const RARE_PAIRS = /jf|jd|jk|jl|js|jh|jg|kj|sj|hj|gj|qj|xj|zj|vj|wj|jq|jx|jz|jv|jw|qz|zq|qx|xq|zx|xz|vq|qv|fq|qf|kq|qk|dk|fk|gk|vk|kv|zk|kz|hx|xh/;

/** A Latin-letter token that no language would produce. */
function mashed(token: string): boolean {
  const t = token.toLowerCase();
  if (/(.)\1{3,}/.test(t)) return true; // "aaaa"
  if (CONSONANT_RUN.test(t.replace(DIGRAPHS, ""))) return true; // "aklsdj", "sjfljsdlkfjs"; "instructions" (nstr) passes
  if (t.length >= 4 && keyboardRun(t)) return true; // "asdf", "qwerty"
  if (t.length >= 6 && /^(.{1,3})\1+.{0,2}$/.test(t)) return true; // "asdasdasd", "hdhdhd", "oiuoiuoiu"
  if (t.length >= 5 && new Set(t).size <= 2) return true; // "hdhdh", "dhdhd"
  if (t.length >= 5 && RARE_PAIRS.test(t.replace(/ij/g, "i"))) return true; // "lkajsd", "aklsdj" (Dutch "ij" excused)
  if (t.length >= 18 && [...t].filter((c) => VOWEL.test(c)).length / t.length < 0.25) return true;
  return false;
}

/** True when the objective is clearly not a task. When in doubt, let it through. */
export function isGibberishObjective(raw: string): boolean {
  const text = raw.normalize("NFC").trim();
  if (!text) return false; // "required" is handled elsewhere
  if (!/\p{L}/u.test(text)) return true; // no letters in any script ("12345 !!!")
  if (/[^\p{Script=Latin}\P{L}]/u.test(text)) return false; // CJK, Cyrillic, Arabic… can't judge cheaply, trust it
  const tokens = (text.toLowerCase().match(/\p{L}+/gu) ?? []);
  if (tokens.some((t) => COMMON.has(t))) return false; // real language somewhere in it
  const judged = tokens.filter((t) => t.length >= 4);
  if (!judged.length) return tokens.join("").length < 3;
  // The same token repeated ("asdf asdf asdf", "blah blah blah") is not a task.
  if (tokens.length >= 2 && new Set(tokens).size === 1) return true;
  // No common word at all: block if most substantial tokens look like mash.
  return judged.filter(mashed).length * 2 > judged.length;
}

/** Shown under a non-objective field when its text doesn't read as words (Simple mode). */
export const UNCLEAR_FIELD_MSG = "This doesn't read as words. Write it in plain language, or clear it.";

/**
 * Same idea as isGibberishObjective, but for the optional fields. Looser: short values ("formal", "Q3",
 * "18-25", "≤ 200 words") are normal here, so only all-mash text and pure punctuation are flagged.
 */
export function isGibberishField(raw: string): boolean {
  const text = raw.normalize("NFC").trim();
  if (!text) return false;
  if (!/\p{L}/u.test(text)) return !/\d/.test(text); // "???", "..." — but numbers like "18-25" are real answers
  if (/[^\p{Script=Latin}\P{L}]/u.test(text)) return false;
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (tokens.some((t) => COMMON.has(t))) return false;
  const judged = tokens.filter((t) => t.length >= 4);
  if (tokens.length >= 2 && new Set(tokens).size === 1 && judged.length) return true; // "asdf asdf"
  return judged.length > 0 && judged.every(fieldMashed);
}

// Conservative mash test for single-word field values, where mashed()'s pair rules would flag real words
// ("liberty", "assassin", "blackjack"). 41 of ~275k English words trip it on their own.
const FIELD_KEY_RUNS = ["qwer", "rtyu", "tyui", "yuio", "uiop", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm"];
function fieldMashed(token: string): boolean {
  const t = token.toLowerCase();
  if (/(.)\1{3,}/.test(t)) return true; // "kkkkk"
  if (/(..)\1{2,}/.test(t)) return true; // "jkjkjk"
  if (FIELD_KEY_RUNS.some((k) => t.includes(k))) return true; // "asdf", "zxcv" ("wert"/"erty" left out: "powertrain", "property")
  if (new RegExp(`[^${V}]{6,}`).test(t)) return true; // "sjfljsdlkfjs"
  return t.length >= 18 && [...t].filter((c) => VOWEL.test(c)).length / t.length < 0.25;
}
