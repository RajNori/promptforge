"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_BRIEF,
  FRAMEWORKS,
  FRAMEWORK_ORDER,
  TARGETS,
  TASK_TYPES,
  autoPick,
  compileTemplate,
  migrateBrief,
  missingSections,
  resolveFramework,
  type Analysis,
  type Brief,
  type Clarification,
  type Example,
  type Rule,
} from "@/lib/forge";
import { Select } from "./Select";
import { AccountBar, useMe } from "./Account";
import { useBriefSync, useHistory } from "./useHistory";
import { LIMITS, cleanText } from "@/lib/sanitize";
import { ExampleMenu, FieldLabel, Sparkle, StarIcon } from "./ui";
import { exampleBrief, type ExampleBrief } from "@/lib/examples";
import { FIELD_HELP, applicableFields, hasSignal, isEmpty, type SuggestField } from "@/lib/help";

type Stage = "brief" | "clarify" | "forge";
type Theme = "system" | "light" | "dark";

const REFINE_PRESETS = [
  "Make it tighter — cut 30% without losing rules",
  "Add stronger guardrails for destructive actions",
  "Add concrete acceptance criteria",
  "Add a good/bad output example",
  "Convert to XML tags",
  "Make it fully autonomous — no check-ins",
  "Add a test-first (TDD) workflow",
  "Add an independent reviewer pass",
];


const THEME_ICONS = {
  system: (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="3" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 13.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  light: (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  dark: (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
};

function highlight(text: string) {
  return text.split("\n").map((line, i) => {
    const t = line.trim();
    const cls = t.startsWith("=== PROMPT") ? "chain" : /^(#{1,3}\s|<\/?[a-z_]+>$)/i.test(t) ? "h" : undefined;
    return (
      <span key={i} className={cls}>
        {line}
        {"\n"}
      </span>
    );
  });
}

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Parse a length instruction ("cut 30%", "under 400 words", "halve it", "tighter") into a word target. */
function lengthTarget(feedback: string, current: number): number | null {
  const f = feedback.toLowerCase();
  const abs = f.match(/(?:under|below|max(?:imum)?|at most|≤|<=?|to|within)\s*(\d{2,5})\s*words?/);
  if (abs) return Math.min(Number(abs[1]), current);
  const pct = f.match(/(?:cut|reduce|trim|shorten|shrink|tighten|tighter)[^%\d]{0,30}(\d{1,2})\s*%/) || f.match(/(\d{1,2})\s*%\s*(?:shorter|less|smaller|fewer)/);
  if (pct) return Math.round(current * (1 - Number(pct[1]) / 100));
  if (/\bhalve\b|\bhalf\b/.test(f)) return Math.round(current / 2);
  if (/\b(tighter|tighten|shorter|more concise|condense)\b/.test(f)) return Math.round(current * 0.8);
  return null;
}

/** Split a prompt into sections by heading (## X, <tag>, === PROMPT …) and give each a proportional word budget. */
function sectionBudgets(text: string, target: number): string {
  const total = countWords(text);
  if (!total) return "";
  const ratio = target / total;
  const parts: { head: string; words: number }[] = [];
  let cur = { head: "(preamble)", words: 0 };
  for (const line of text.split("\n")) {
    const t = line.trim();
    const isHead = /^#{1,4}\s/.test(t) || /^<[a-z_]+>$/i.test(t) || t.startsWith("=== PROMPT");
    if (isHead) {
      if (cur.words) parts.push(cur);
      cur = { head: t.replace(/^#+\s*/, "").slice(0, 60), words: 0 };
    } else cur.words += countWords(t);
  }
  if (cur.words) parts.push(cur);
  return parts.map((p) => `- ${p.head}: ${p.words} → ≤ ${Math.max(4, Math.round(p.words * ratio))} words`).join("\n");
}

const FIELD_MAX: Partial<Record<keyof Brief, number>> = {
  objective: LIMITS.objective,
  context: LIMITS.context,
  role: LIMITS.short,
  audience: LIMITS.short,
  tone: LIMITS.short,
  inputs: LIMITS.medium,
  deliverable: LIMITS.medium,
  successCriteria: LIMITS.medium,
  outputFormat: LIMITS.medium,
  prefill: LIMITS.prefill,
  outputSchema: LIMITS.schema,
};

const X = (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default function Page() {
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [stage, setStage] = useState<Stage>("brief");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answers, setAnswers] = useState<Clarification[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState<null | "analyze" | "generate" | "refine" | "repair">(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [server, setServer] = useState<{ configured: boolean; requiresAccessCode: boolean } | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const abortRef = useRef<AbortController | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [sparking, setSparking] = useState<SuggestField | "all" | null>(null);
  const [toast, setToast] = useState<{ msg: string; prev?: Brief } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { me, refresh: refreshMe } = useMe();
  const onHistoryError = useCallback((msg: string) => showToast(msg), []); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useHistory(me ? me.sync : null, onHistoryError);
  const { versions, activeId: active, setActiveId: setActive } = history;
  useBriefSync(history.projectId, brief);

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => setServer({ configured: false, requiresAccessCode: false }));
    try {
      const saved = localStorage.getItem("risen-forge:brief");
      if (saved) setBrief(migrateBrief(JSON.parse(saved)));
      const ac = localStorage.getItem("risen-forge:access");
      if (ac) setAccessCode(ac);
      localStorage.removeItem("risen-forge:model");
      const t = localStorage.getItem("risen-forge:theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("risen-forge:brief", JSON.stringify(brief));
    } catch {}
  }, [brief]);

  function applyTheme(t: Theme) {
    setTheme(t);
    const el = document.documentElement;
    if (t === "system") delete el.dataset.theme;
    else el.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("risen-forge:theme");
      else localStorage.setItem("risen-forge:theme", t);
    } catch {}
  }

  // Client-side hygiene mirrors the server (which is the real control): strip invisible/control chars, cap length.
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) =>
    setBrief((b) => ({ ...b, [k]: typeof v === "string" && FIELD_MAX[k] ? (cleanText(v, FIELD_MAX[k]!) as Brief[K]) : v }));
  const setExt = (k: keyof Brief["extensions"], v: boolean) => setBrief((b) => ({ ...b, extensions: { ...b.extensions, [k]: v } }));
  const cleanPatch = <T extends object>(patch: T, max: number) =>
    Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? cleanText(v, max) : v])) as T;
  const setRule = (i: number, patch: Partial<Rule>) =>
    setBrief((b) => ({ ...b, rules: b.rules.map((r, j) => (j === i ? { ...r, ...cleanPatch(patch, LIMITS.rule) } : r)) }));
  const setEx = (i: number, patch: Partial<Example>) =>
    setBrief((b) => ({ ...b, examples: b.examples.map((e, j) => (j === i ? { ...e, ...cleanPatch(patch, LIMITS.example) } : e)) }));

  const fw = resolveFramework(brief);
  const autoFw = FRAMEWORKS[autoPick(brief.target, brief.taskType)];
  const current = versions.find((v) => v.id === active) ?? null;
  const streamingNow = busy === "generate" || busy === "refine" || busy === "repair";
  const shown = streamingNow ? streaming : current?.text ?? "";
  const canAI = server?.configured;
  const ready = brief.objective.trim().length > 8;
  const isApi = brief.target === "api-system";
  const signal = hasSignal(brief);
  const blanks = applicableFields(brief).filter((f) => isEmpty(brief, f));
  const spark = (f: SuggestField) =>
    canAI ? (
      <Sparkle
        label={FIELD_HELP[f].label}
        filled={!isEmpty(brief, f)}
        loading={sparking === f || (sparking === "all" && isEmpty(brief, f))}
        disabled={(f !== "objective" && !signal) || (f === "objective" && !signal && !brief.objective.trim()) || (!!sparking && sparking !== f)}
        onClick={() => suggest(f)}
      />
    ) : null;

  const headers = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (accessCode) h["x-access-code"] = accessCode;
    return h;
  }, [accessCode]);

  function persistPrefs() {
    try {
      localStorage.setItem("risen-forge:access", accessCode);
    } catch {}
  }

  /** Save a version (or replace one — auto-fixes overwrite the attempt they fixed). */
  async function pushVersion(text: string, label: string, replaceId?: string) {
    const missing = missingSections(text, brief);
    const id = await history.save(brief, text, label, missing, replaceId);
    return { id, missing };
  }

  async function stream(body: object): Promise<string | null> {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming("");
    setStage("forge");
    setStartedAt(Date.now());
    let acc = "";
    try {
      const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Request failed (${r.status})`);
      }
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const cut = acc.indexOf("\u0004");
        setStreaming(cut < 0 ? acc : acc.slice(0, cut));
      }
      const eot = acc.lastIndexOf("\u0004");
      if (eot < 0) throw new Error("Generation was cut off before it finished. Try again — or use Lean depth for faster results.");
      const status = acc.slice(eot + 1);
      const clean = acc.slice(0, eot).replace(/^```[a-z]*\n?|\n?```\s*$/g, "").trim();
      if (!clean) throw new Error("Empty response. Please try again.");
      if (status === "blocked") throw new Error("That request couldn't be processed. Rephrase your brief and try again.");
      if (status === "off") throw new Error("The output didn't follow the prompt format, so it wasn't saved. Try again or rephrase the brief.");
      if (status === "len") setError("Output hit the length limit and may be incomplete — try Lean depth or turn off chain mode.");
      return clean;
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      return null;
    } finally {
      setStreaming("");
      setStartedAt(null);
      refreshMe();
    }
  }

  /** Validate the framework contract; auto-repair once if headings are missing. */
  async function finish(res: string | null, label: string) {
    if (!res) return;
    const { id, missing } = await pushVersion(res, label);
    if (missing.length) {
      setBusy("repair");
      const fixed = await stream({
        mode: "refine",
        auto: true,
        brief,
        prompt: res,
        feedback: `The prompt violates the ${fw.name} output contract. Restore these missing required sections with proper headings, in the correct order, without removing anything else: ${missing.join(", ")}.`,
      });
      if (fixed) await pushVersion(fixed, `${label} (repaired)`, id);
    }
  }

  function showToast(msg: string, prev?: Brief) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, prev });
    toastTimer.current = setTimeout(() => setToast(null), 9000);
  }

  async function suggest(field: SuggestField | "all") {
    if (sparking) return;
    setError("");
    persistPrefs();
    setSparking(field);
    const prev = brief;
    try {
      const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify({ mode: "suggest", brief, field }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Suggestion failed");
      refreshMe();
      const values = d.values as Partial<Brief>;
      const keys = Object.keys(values) as SuggestField[];
      setBrief((b) => ({ ...b, ...values }));
      const names = keys.map((k) => FIELD_HELP[k].label);
      showToast(field === "all" ? `Filled ${keys.length} field${keys.length === 1 ? "" : "s"}: ${names.join(", ")}` : `${isEmpty(prev, field) ? "Filled" : "Improved"} ${names[0]}`, prev);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSparking(null);
    }
  }

  function loadExample(ex: ExampleBrief) {
    setBrief(exampleBrief(ex));
    setAnalysis(null);
    setAnswers([]);
    setStage("brief");
    showToast(`Loaded example: ${ex.name}`, brief);
  }

  function newPrompt() {
    history.reset();
    setBrief(EMPTY_BRIEF);
    setAnalysis(null);
    setAnswers([]);
    setStage("brief");
  }

  async function openProject(id: string) {
    const b = await history.open(id);
    if (b) {
      setBrief(migrateBrief(b));
      setAnalysis(null);
      setAnswers([]);
      setStage("forge");
    }
  }

  async function analyze() {
    setError("");
    if (!canAI) return instant();
    persistPrefs();
    setBusy("analyze");
    try {
      const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify({ mode: "analyze", brief }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Analysis failed");
      setAnalysis(d);
      setAnswers((d.questions as Clarification[]).map((q) => ({ ...q, answer: "" })));
      if (!d.questions?.length) {
        setBusy(null);
        await generate([]);
        return;
      }
      setStage("clarify");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy((b) => (b === "analyze" ? null : b));
    }
  }

  async function generate(clar: Clarification[] = answers) {
    setError("");
    if (!canAI) return instant(clar);
    persistPrefs();
    setBusy("generate");
    try {
      await finish(await stream({ mode: "generate", brief, clarifications: clar }), `${fw.name}${brief.chain ? " chain" : ""}`);
    } finally {
      setBusy(null);
    }
  }

  async function refine(text = feedback) {
    if (!current || !text.trim()) return;
    setError("");
    setBusy("refine");
    try {
      const before = countWords(current.text);
      const target = lengthTarget(text, before);
      // Give the model an explicit number — "cut 30%" alone is followed loosely.
      const ask = target
        ? `${text}\n\nLENGTH TARGET: the current prompt is ${before} words; the revision must be ≤ ${target} words total. Per-section word budgets (current → max):\n${sectionBudgets(current.text, target)}\nHit each budget: merge overlapping bullets, cut restated context and filler, use terse imperative phrasing. Keep every heading, every rule with its reason, and every acceptance criterion.`
        : text;
      let res = await stream({ mode: "refine", brief, prompt: current.text, feedback: ask });
      if (!res) return;

      const label = (n: number) => (target ? `${text.slice(0, 32)} (${n}w)` : text.slice(0, 40));
      const { id } = await pushVersion(res, label(countWords(res)));
      setFeedback("");

      // One automatic retry if a length cut fell short (10% tolerance) — replaces the attempt it fixes.
      if (target && countWords(res) > target * 1.1) {
        setBusy("repair");
        const got = countWords(res);
        const fixed = await stream({
          mode: "refine",
          auto: true,
          brief,
          prompt: res,
          feedback: `Still too long: ${got} words, must be ≤ ${target}. Cut at least ${got - target} more words. Per-section budgets (current → max):\n${sectionBudgets(res, target)}\nCompress every section to its budget: one line per bullet, no restated context, no filler words. Keep every heading, every rule with its reason, and every acceptance criterion.`,
        });
        if (fixed) {
          res = fixed;
          await pushVersion(res, label(countWords(res)), id);
        }
      }
      const final = countWords(res);
      if (target && final > target * 1.1) showToast(`Closest result: ${before} → ${final} words (target ${target}). Refine again to cut further.`);
    } finally {
      setBusy(null);
    }
  }

  function instant(clar: Clarification[] = answers) {
    pushVersion(compileTemplate(brief, clar), `${fw.name} template`);
    setStage("forge");
  }

  async function copy() {
    if (!shown) return;
    await navigator.clipboard.writeText(shown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function download() {
    if (!current) return;
    const blob = new Blob([current.text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-${fw.id}-v${current.seq}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const thinking = streamingNow && !streaming;

  const words = shown ? shown.trim().split(/\s+/).length : 0;
  const chainCount = shown ? (shown.match(/^=== PROMPT/gm) || []).length : 0;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <h1>
            <b>Prompt</b> Forge
          </h1>
          <span>One brief → RISEN · CO-STAR · RTF · CRISPE · BAB</span>
        </div>
        <div className="top-r">
        <AccountBar me={me} onOpenProject={openProject} onNewProject={newPrompt} />
        <div className="theme" role="radiogroup" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} aria-label={t} title={t[0].toUpperCase() + t.slice(1)} className={theme === t ? "on" : ""} onClick={() => applyTheme(t)}>
              {THEME_ICONS[t]}
            </button>
          ))}
        </div>
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <div className="panel-h">
            <nav className="steps">
              <button className={`step ${stage === "brief" ? "on" : ""}`} onClick={() => setStage("brief")}>
                <span className="n">1</span>Brief
              </button>
              <button className={`step ${stage === "clarify" ? "on" : ""}`} disabled={!analysis} onClick={() => setStage("clarify")}>
                <span className="n">2</span>Clarify
              </button>
              <button className={`step ${stage === "forge" ? "on" : ""}`} disabled={!versions.length && !busy} onClick={() => setStage("forge")}>
                <span className="n">3</span>Forge
              </button>
            </nav>
            <div style={{ display: "flex", gap: 6 }}>
              <ExampleMenu onPick={loadExample} currentType={brief.taskType} />
              <button className="btn ghost sm" onClick={newPrompt} title="Start a new prompt">
                New
              </button>
            </div>
          </div>

          <div className="panel-b">
            {error && <div className="err">{error}</div>}

            {stage !== "clarify" && (
              <>
                <div className="field">
                  <label>Target</label>
                  <div className="chips">
                    {TARGETS.map((t) => (
                      <button key={t.id} className={`chip ${brief.target === t.id ? "on" : ""}`} onClick={() => set("target", t.id)}>
                        {t.label}
                        <small>{t.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="row">
                  <div className="field">
                    <label>Task type</label>
                    <Select ariaLabel="Task type" value={brief.taskType} onChange={(v) => set("taskType", v)} options={TASK_TYPES.map((t) => ({ value: t, label: t }))} />
                  </div>
                  <div className="field">
                    <FieldLabel field="role" label="Role" hint="optional" spark={spark("role")} />
                    <input type="text" value={brief.role} maxLength={FIELD_MAX.role} onChange={(e) => set("role", e.target.value)} placeholder="Principal engineer, Next.js + Supabase" />
                  </div>
                </div>

                <div className="field">
                  <label>
                    Framework <em>{fw.expansion}</em>
                  </label>
                  <div className="fw">
                    <button className={`fw-opt ${brief.framework === "auto" ? "on" : ""}`} onClick={() => set("framework", "auto")}>
                      <b>Auto</b>
                      <small>→ {autoFw.name}</small>
                    </button>
                    {FRAMEWORK_ORDER.map((id) => (
                      <button key={id} className={`fw-opt ${brief.framework === id ? "on" : ""}`} onClick={() => set("framework", id)} title={FRAMEWORKS[id].tagline}>
                        <b>{FRAMEWORKS[id].name}</b>
                        <small>{FRAMEWORKS[id].tagline.split(" ").slice(0, 2).join(" ")}</small>
                      </button>
                    ))}
                  </div>
                  <p className="note" style={{ margin: "6px 0 0" }}>
                    {brief.framework === "auto" ? `Auto-picked from ${brief.taskType} + target: ` : ""}
                    <b>{fw.name}</b> — {fw.tagline.toLowerCase()}.
                  </p>
                </div>

                <div className="field">
                  <FieldLabel field="objective" label="Objective" required hint="what must be accomplished" spark={spark("objective")} />
                  <textarea rows={3} value={brief.objective} maxLength={FIELD_MAX.objective} onChange={(e) => set("objective", e.target.value)} placeholder="Implement…, migrate…, write…, analyse…" />
                </div>

                <div className="field">
                  <FieldLabel
                    field="context"
                    label={fw.id === "bab" ? "Before — current state" : "Context"}
                    hint={fw.id === "bab" ? "what exists today, what's wrong" : "stack, background, situation"}
                    spark={spark("context")}
                  />
                  <textarea rows={3} value={brief.context} maxLength={FIELD_MAX.context} onChange={(e) => set("context", e.target.value)} placeholder="Next.js 16, TypeScript, Supabase RLS, Vercel…" />
                </div>

                {fw.usesAudienceTone && (
                  <div className="row reveal">
                    <div className="field">
                      <FieldLabel field="audience" label="Audience" hint={fw.name} spark={spark("audience")} />
                      <input type="text" value={brief.audience} maxLength={FIELD_MAX.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Technical founders evaluating vendors" />
                    </div>
                    <div className="field">
                      <FieldLabel field="tone" label="Tone" hint={fw.name} spark={spark("tone")} />
                      <input type="text" value={brief.tone} maxLength={FIELD_MAX.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Direct, credible, zero hype" />
                    </div>
                  </div>
                )}

                <div className="row">
                  <div className="field">
                    <FieldLabel field="deliverable" label="Deliverable" spark={spark("deliverable")} />
                    <textarea rows={2} value={brief.deliverable} maxLength={FIELD_MAX.deliverable} onChange={(e) => set("deliverable", e.target.value)} placeholder="PR-ready feature, article, spec…" />
                  </div>
                  <div className="field">
                    <FieldLabel field="successCriteria" label="Success criteria" hint="one per line" spark={spark("successCriteria")} />
                    <textarea rows={2} value={brief.successCriteria} maxLength={FIELD_MAX.successCriteria} onChange={(e) => set("successCriteria", e.target.value)} placeholder="Tests pass, p95 < 200ms…" />
                  </div>
                </div>

                <div className="field">
                  <FieldLabel field="rules" label="Rules" hint="the why makes models follow them" spark={spark("rules")} />
                  <div className="rules">
                    {brief.rules.map((r, i) => (
                      <div className="rule" key={i}>
                        <input type="text" value={r.rule} maxLength={LIMITS.rule} onChange={(e) => setRule(i, { rule: e.target.value })} placeholder="No new dependencies" aria-label={`Rule ${i + 1}`} />
                        <span className="because">because</span>
                        <input type="text" value={r.why} maxLength={LIMITS.rule} onChange={(e) => setRule(i, { why: e.target.value })} placeholder="bundle budget (optional)" aria-label={`Reason for rule ${i + 1}`} />
                        <button
                          className="icon-btn"
                          aria-label="Remove rule"
                          onClick={() => setBrief((b) => ({ ...b, rules: b.rules.length > 1 ? b.rules.filter((_, j) => j !== i) : [{ rule: "", why: "" }] }))}
                        >
                          {X}
                        </button>
                      </div>
                    ))}
                    <button className="add" onClick={() => setBrief((b) => ({ ...b, rules: [...b.rules, { rule: "", why: "" }] }))}>
                      + Add rule
                    </button>
                  </div>
                </div>

                {isApi && (
                  <div className="row reveal">
                    <div className="field">
                      <FieldLabel field="prefill" label="Prefill" hint="first assistant tokens" spark={spark("prefill")} />
                      <textarea rows={3} className="mono" value={brief.prefill} maxLength={FIELD_MAX.prefill} onChange={(e) => set("prefill", e.target.value)} placeholder={'{"result": '} />
                    </div>
                    <div className="field">
                      <FieldLabel field="outputSchema" label="Output schema" hint="JSON" spark={spark("outputSchema")} />
                      <textarea rows={3} className="mono" value={brief.outputSchema} maxLength={FIELD_MAX.outputSchema} onChange={(e) => set("outputSchema", e.target.value)} placeholder={'{ "type": "object", "properties": { … } }'} />
                    </div>
                  </div>
                )}

                <div className="row">
                  <div className="field">
                    <label>Autonomy</label>
                    <div className="seg">
                      {(["ask-first", "bounded", "autonomous"] as const).map((a) => (
                        <button key={a} className={brief.autonomy === a ? "on" : ""} onClick={() => set("autonomy", a)}>
                          {a === "ask-first" ? "Ask first" : a === "bounded" ? "Bounded" : "Autonomous"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>
                      Output <em>chain splits complex work</em>
                    </label>
                    <div className="seg">
                      <button className={!brief.chain ? "on" : ""} onClick={() => set("chain", false)}>
                        Single prompt
                      </button>
                      <button className={brief.chain ? "on" : ""} onClick={() => set("chain", true)}>
                        Chain (2–4)
                      </button>
                    </div>
                  </div>
                </div>

                <details>
                  <summary>Advanced — examples, inputs, format, depth, extensions</summary>

                  <div className="field">
                    <FieldLabel field="examples" label="Few-shot examples" hint={`${brief.examples.length}/3 · rendered as <example> blocks`} />
                    {brief.examples.map((ex, i) => (
                      <div className="example" key={i}>
                        <div className="example-h">
                          <span>Example {i + 1}</span>
                          <button className="icon-btn" aria-label="Remove example" onClick={() => setBrief((b) => ({ ...b, examples: b.examples.filter((_, j) => j !== i) }))}>
                            {X}
                          </button>
                        </div>
                        <div className="row">
                          <textarea rows={3} value={ex.input} maxLength={LIMITS.example} onChange={(e) => setEx(i, { input: e.target.value })} placeholder="Input" />
                          <textarea rows={3} value={ex.output} maxLength={LIMITS.example} onChange={(e) => setEx(i, { output: e.target.value })} placeholder="Ideal output" />
                        </div>
                      </div>
                    ))}
                    {brief.examples.length < 3 && (
                      <button className="add" onClick={() => setBrief((b) => ({ ...b, examples: [...b.examples, { input: "", output: "" }] }))}>
                        + Add example
                      </button>
                    )}
                  </div>

                  <div className="row">
                    <div className="field">
                      <FieldLabel field="inputs" label="Inputs / assets" spark={spark("inputs")} />
                      <textarea rows={2} value={brief.inputs} maxLength={FIELD_MAX.inputs} onChange={(e) => set("inputs", e.target.value)} placeholder="Files, docs, keys, data available" />
                    </div>
                    <div className="field">
                      <FieldLabel field="outputFormat" label="Response format" spark={spark("outputFormat")} />
                      <textarea rows={2} value={brief.outputFormat} maxLength={FIELD_MAX.outputFormat} onChange={(e) => set("outputFormat", e.target.value)} placeholder="Final report shape, length, structure" />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label>Depth</label>
                      <div className="seg">
                        {(["lean", "standard", "exhaustive"] as const).map((d) => (
                          <button key={d} className={brief.depth === d ? "on" : ""} onClick={() => set("depth", d)}>
                            {d[0].toUpperCase() + d.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label>Syntax</label>
                      <div className="seg">
                        {(["markdown", "xml"] as const).map((s) => (
                          <button key={s} className={brief.syntax === s ? "on" : ""} onClick={() => set("syntax", s)}>
                            {s === "xml" ? "XML tags" : "Markdown"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="field">
                    <label>Extensions</label>
                    <div className="toggles">
                      {(
                        [
                          ["acceptanceCriteria", "Acceptance criteria"],
                          ["evidence", "Evidence gates"],
                          ["authorityBoundaries", "Authority boundaries"],
                          ["definitionOfDone", "Definition of Done"],
                          ["selfCritique", "Self-critique pass"],
                          ["examples", "Good/bad examples"],
                        ] as const
                      ).map(([k, l]) => (
                        <label key={k} className="tog">
                          <input type="checkbox" checked={brief.extensions[k]} onChange={(e) => setExt(k, e.target.checked)} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  {server?.requiresAccessCode && (
                    <div className="field">
                      <label>Access code</label>
                      <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Required" />
                    </div>
                  )}
                </details>

                <div className="actions">
                  <button className="btn primary" disabled={!ready || !!busy} onClick={analyze}>
                    {busy === "analyze" ? "Analysing brief…" : canAI ? "Analyse & ask questions →" : "Generate →"}
                  </button>
                  {canAI && (
                    <button className="btn" disabled={!ready || !!busy} onClick={() => generate([])}>
                      Skip questions
                    </button>
                  )}
                  <button className="btn ghost" disabled={!ready || !!busy} onClick={() => instant()}>
                    Instant template
                  </button>
                  {canAI && (
                    <button
                      className={`btn ghost ai ${sparking === "all" ? "busy" : ""}`}
                      disabled={!signal || !blanks.length || !!sparking || !!busy}
                      onClick={() => suggest("all")}
                      title={!signal ? "Add an objective or context first" : blanks.length ? `AI fills: ${blanks.map((f) => FIELD_HELP[f].label).join(", ")}` : "No blank fields"}
                    >
                      {StarIcon} {sparking === "all" ? "Filling…" : `Autofill blanks${blanks.length ? ` (${blanks.length})` : ""}`}
                    </button>
                  )}
                </div>
                {!ready && <p className="note">Write an objective to continue{canAI ? " — or add some context and use ✦ to draft it" : ""}.</p>}
              </>
            )}

            {stage === "clarify" && analysis && (
              <>
                <div className="score">
                  <span className="note">Brief completeness</span>
                  <div className="bar">
                    <i style={{ width: `${analysis.score}%` }} />
                  </div>
                  <span className="meta">{analysis.score}/100</span>
                </div>
                {analysis.gaps.length > 0 && (
                  <ul className="gaps">
                    {analysis.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                )}
                {answers.map((q, i) => (
                  <div className="q" key={i}>
                    <p>{q.question}</p>
                    <small>{q.why}</small>
                    <input
                      type="text"
                      value={q.answer}
                      maxLength={LIMITS.answer}
                      onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                      onKeyDown={(e) => e.key === "Enter" && i === answers.length - 1 && generate()}
                      placeholder="Answer, or leave blank to let the model decide"
                      autoFocus={i === 0}
                    />
                  </div>
                ))}
                <div className="actions">
                  <button className="btn primary" disabled={!!busy} onClick={() => generate()}>
                    {busy === "generate" ? "Forging…" : `Forge ${fw.name}${brief.chain ? " chain" : ""} →`}
                  </button>
                  <button className="btn ghost" onClick={() => setStage("brief")}>
                    ← Edit brief
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <div className="versions">
              {versions.length === 0 && <span className="note">Output</span>}
              {versions.map((v) => (
                <span key={v.id} className={`ver-wrap ${v.id === active ? "on" : ""}`}>
                  <button className={`ver ${v.id === active ? "on" : ""} ${v.missing.length ? "warn" : ""} ${v.pinned ? "pinned" : ""}`} onClick={() => setActive(v.id)} title={v.label}>
                    v{v.seq}
                  </button>
                  <button className={`pin ${v.pinned ? "on" : ""}`} onClick={() => history.togglePin(v.id)} title={v.pinned ? "Unpin (may be removed once 5 newer versions exist)" : "Pin — keep this version"} aria-label={v.pinned ? `Unpin v${v.seq}` : `Pin v${v.seq}`} aria-pressed={v.pinned}>
                    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
                      <path d="M10 1.5l4.5 4.5-2 1-2.5 2.5.5 3.5-1.5 1.5L6 11l-3.5 3.5L1.5 13.5 5 10 2 7l1.5-1.5 3.5.5L9.5 3.5z" fill={v.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                  </button>
                </span>
              ))}
              {versions.some((v) => !v.pinned) && (
                <button className="clear-hist" onClick={() => confirm("Clear unpinned versions?") && history.clear()} title="Remove unpinned versions">
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {busy === "repair" && <span className="meta">auto-fixing…</span>}
              {streamingNow && <span className="meta">{thinking ? `thinking… ${elapsed}s` : `writing… ${elapsed}s`}</span>}
              {shown && <span className="meta">{chainCount > 1 ? `${chainCount} prompts · ` : ""}{words}w</span>}
              {streamingNow && (
                <button className="btn sm" onClick={() => abortRef.current?.abort()}>
                  Stop
                </button>
              )}
              <button className="btn sm" disabled={!shown} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button className="btn sm" disabled={!current || !!busy} onClick={download}>
                .md
              </button>
            </div>
          </div>
          {current && !streamingNow && (
            <div className={`contract ${current.missing.length ? "bad" : "ok"}`}>
              {current.missing.length ? `Missing ${current.missing.join(", ")} — ask a refinement to restore` : `${current.label} · all required sections present`}
            </div>
          )}
          <pre className={`out ${shown ? "" : "empty"}`}>
            {shown ? (
              <>
                {highlight(shown)}
                {streamingNow && <span className="caret" />}
              </>
            ) : streamingNow ? (
              <span className="thinking">
                <span className="caret" /> {busy === "refine" ? "Applying your refinement" : busy === "repair" ? "Auto-fixing the last result" : "Planning the prompt"} — {elapsed}s
              </span>
            ) : (
              "Fill the brief → answer the gap questions → get a framework-structured prompt.\nThen fine-tune it with plain-English feedback."
            )}
          </pre>
          {current && canAI && (
            <div className="refine">
              <div className="chips">
                {REFINE_PRESETS.map((p) => (
                  <button key={p} className="chip" disabled={!!busy} onClick={() => refine(p)}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="refine-row">
                <textarea
                  value={feedback}
                  maxLength={LIMITS.feedback}
                  onChange={(e) => setFeedback(cleanText(e.target.value, LIMITS.feedback))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) refine();
                  }}
                  placeholder="Fine-tune: e.g. 'target Python/FastAPI instead', 'add rollback plan' (⌘↵)"
                />
                <button className="btn primary" disabled={!feedback.trim() || !!busy} onClick={() => refine()}>
                  {busy === "refine" ? "…" : "Refine"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.prev && (
            <button
              onClick={() => {
                setBrief(toast.prev!);
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
          <button aria-label="Dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
      <p className="foot">Brief is saved locally in your browser. Prompts are generated server-side; nothing is stored.</p>
    </div>
  );
}
