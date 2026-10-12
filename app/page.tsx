"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Stage = "brief" | "clarify" | "forge";
type Theme = "system" | "light" | "dark";
type Version = { id: number; label: string; text: string; model: string; missing: string[] };

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

const EXAMPLE: Brief = {
  ...EMPTY_BRIEF,
  target: "claude-code",
  taskType: "Build a feature",
  objective: "Add Stripe Checkout subscriptions (monthly + annual) to our SaaS with webhook-driven entitlement updates.",
  context: "Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS + Auth), deployed on Vercel. Users table exists; no billing yet.",
  inputs: "Stripe test keys in .env.local, price IDs for both plans, existing /settings page.",
  deliverable: "Working checkout flow, webhook handler, entitlements table + RLS, billing section in /settings.",
  successCriteria:
    "Test-mode purchase upgrades the user within 5s via webhook\nCancelling in the Stripe portal downgrades at period end\nWebhook is idempotent and signature-verified\nAll tests, typecheck, and build pass",
  rules: [
    { rule: "Never trust plan state from the client", why: "entitlements must be server-authoritative or users can self-upgrade" },
    { rule: "No new UI libraries", why: "bundle budget and design-system consistency" },
    { rule: "Do not touch auth flows", why: "out of scope and high blast radius" },
  ],
};

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
  const [versions, setVersions] = useState<Version[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState<null | "analyze" | "generate" | "refine" | "repair">(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [server, setServer] = useState<{ configured: boolean; requiresAccessCode: boolean; defaultModel: string } | null>(null);
  const [model, setModel] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const abortRef = useRef<AbortController | null>(null);
  const verSeq = useRef(0);

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => setServer({ configured: false, requiresAccessCode: false, defaultModel: "" }));
    try {
      const saved = localStorage.getItem("risen-forge:brief");
      if (saved) setBrief(migrateBrief(JSON.parse(saved)));
      const ac = localStorage.getItem("risen-forge:access");
      if (ac) setAccessCode(ac);
      const m = localStorage.getItem("risen-forge:model");
      if (m) setModel(m);
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

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));
  const setExt = (k: keyof Brief["extensions"], v: boolean) => setBrief((b) => ({ ...b, extensions: { ...b.extensions, [k]: v } }));
  const setRule = (i: number, patch: Partial<Rule>) => setBrief((b) => ({ ...b, rules: b.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setEx = (i: number, patch: Partial<Example>) => setBrief((b) => ({ ...b, examples: b.examples.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const fw = resolveFramework(brief);
  const autoFw = FRAMEWORKS[autoPick(brief.target, brief.taskType)];
  const current = versions.find((v) => v.id === active) ?? null;
  const streamingNow = busy === "generate" || busy === "refine" || busy === "repair";
  const shown = streamingNow ? streaming : current?.text ?? "";
  const canAI = server?.configured;
  const ready = brief.objective.trim().length > 8;
  const isApi = brief.target === "api-system";

  const headers = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (accessCode) h["x-access-code"] = accessCode;
    return h;
  }, [accessCode]);

  function persistPrefs() {
    try {
      localStorage.setItem("risen-forge:access", accessCode);
      localStorage.setItem("risen-forge:model", model);
    } catch {}
  }

  function pushVersion(text: string, label: string, m: string) {
    const id = ++verSeq.current;
    const missing = missingSections(text, brief);
    setVersions((vs) => [...vs, { id, label, text, model: m, missing }]);
    setActive(id);
    return missing;
  }

  async function stream(body: object): Promise<{ text: string; model: string } | null> {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming("");
    setStage("forge");
    let acc = "";
    try {
      const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Request failed (${r.status})`);
      }
      const m = r.headers.get("x-model") || model || server?.defaultModel || "";
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setStreaming(acc);
      }
      const clean = acc.replace(/^```[a-z]*\n?|\n?```\s*$/g, "").trim();
      if (!clean) throw new Error("Empty response from model.");
      return { text: clean, model: m };
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      return null;
    } finally {
      setStreaming("");
    }
  }

  /** Validate the framework contract; auto-repair once if headings are missing. */
  async function finish(res: { text: string; model: string } | null, label: string) {
    if (!res) return;
    const missing = pushVersion(res.text, label, res.model);
    if (missing.length) {
      setBusy("repair");
      const fixed = await stream({
        mode: "refine",
        brief,
        prompt: res.text,
        model,
        feedback: `The prompt violates the ${fw.name} output contract. Restore these missing required sections with proper headings, in the correct order, without removing anything else: ${missing.join(", ")}.`,
      });
      if (fixed) pushVersion(fixed.text, "auto-repair", fixed.model);
    }
  }

  async function analyze() {
    setError("");
    if (!canAI) return instant();
    persistPrefs();
    setBusy("analyze");
    try {
      const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify({ mode: "analyze", brief, model }) });
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
      await finish(await stream({ mode: "generate", brief, clarifications: clar, model }), `${fw.name}${brief.chain ? " chain" : ""}`);
    } finally {
      setBusy(null);
    }
  }

  async function refine(text = feedback) {
    if (!current || !text.trim()) return;
    setError("");
    setBusy("refine");
    try {
      const res = await stream({ mode: "refine", brief, prompt: current.text, feedback: text, model });
      if (res) {
        pushVersion(res.text, text.slice(0, 40), res.model);
        setFeedback("");
      }
    } finally {
      setBusy(null);
    }
  }

  function instant(clar: Clarification[] = answers) {
    pushVersion(compileTemplate(brief, clar), `${fw.name} template`, "offline");
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
    a.download = `prompt-${fw.id}-v${current.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
        <div className="theme" role="radiogroup" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} aria-label={t} title={t[0].toUpperCase() + t.slice(1)} className={theme === t ? "on" : ""} onClick={() => applyTheme(t)}>
              {THEME_ICONS[t]}
            </button>
          ))}
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
              <button className="btn ghost sm" onClick={() => setBrief(EXAMPLE)}>
                Load example
              </button>
              <button
                className="btn ghost sm"
                onClick={() => {
                  setBrief(EMPTY_BRIEF);
                  setAnalysis(null);
                  setAnswers([]);
                  setStage("brief");
                }}
              >
                Reset
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
                    <label>
                      Role <em>optional — inferred if blank</em>
                    </label>
                    <input type="text" value={brief.role} onChange={(e) => set("role", e.target.value)} placeholder="Principal engineer, Next.js + Supabase" />
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
                  <label>
                    <span>
                      Objective <span className="req">*</span>
                    </span>
                    <em>what must be accomplished</em>
                  </label>
                  <textarea rows={3} value={brief.objective} onChange={(e) => set("objective", e.target.value)} placeholder="Implement…, migrate…, write…, analyse…" />
                </div>

                <div className="field">
                  <label>
                    {fw.id === "bab" ? "Before — current state" : "Context"} <em>{fw.id === "bab" ? "what exists today and what's wrong with it" : "stack, background, situation"}</em>
                  </label>
                  <textarea rows={3} value={brief.context} onChange={(e) => set("context", e.target.value)} placeholder="Next.js 16, TypeScript, Supabase RLS, Vercel…" />
                </div>

                {fw.usesAudienceTone && (
                  <div className="row reveal">
                    <div className="field">
                      <label>
                        Audience <em>{fw.name}</em>
                      </label>
                      <input type="text" value={brief.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Technical founders evaluating vendors" />
                    </div>
                    <div className="field">
                      <label>
                        Tone <em>{fw.name}</em>
                      </label>
                      <input type="text" value={brief.tone} onChange={(e) => set("tone", e.target.value)} placeholder="Direct, credible, zero hype" />
                    </div>
                  </div>
                )}

                <div className="row">
                  <div className="field">
                    <label>Deliverable</label>
                    <textarea rows={2} value={brief.deliverable} onChange={(e) => set("deliverable", e.target.value)} placeholder="PR-ready feature, article, spec…" />
                  </div>
                  <div className="field">
                    <label>
                      Success criteria <em>one per line</em>
                    </label>
                    <textarea rows={2} value={brief.successCriteria} onChange={(e) => set("successCriteria", e.target.value)} placeholder="Tests pass, p95 < 200ms…" />
                  </div>
                </div>

                <div className="field">
                  <label>
                    Rules <em>the why makes models follow them</em>
                  </label>
                  <div className="rules">
                    {brief.rules.map((r, i) => (
                      <div className="rule" key={i}>
                        <input type="text" value={r.rule} onChange={(e) => setRule(i, { rule: e.target.value })} placeholder="No new dependencies" aria-label={`Rule ${i + 1}`} />
                        <span className="because">because</span>
                        <input type="text" value={r.why} onChange={(e) => setRule(i, { why: e.target.value })} placeholder="bundle budget (optional)" aria-label={`Reason for rule ${i + 1}`} />
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
                      <label>
                        Prefill <em>first assistant tokens</em>
                      </label>
                      <textarea rows={3} className="mono" value={brief.prefill} onChange={(e) => set("prefill", e.target.value)} placeholder={'{"result": '} />
                    </div>
                    <div className="field">
                      <label>
                        Output schema <em>JSON</em>
                      </label>
                      <textarea rows={3} className="mono" value={brief.outputSchema} onChange={(e) => set("outputSchema", e.target.value)} placeholder={'{ "type": "object", "properties": { … } }'} />
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
                  <summary>Advanced — examples, inputs, format, depth, extensions, model</summary>

                  <div className="field">
                    <label>
                      Few-shot examples <em>{brief.examples.length}/3 · rendered as &lt;example&gt; blocks</em>
                    </label>
                    {brief.examples.map((ex, i) => (
                      <div className="example" key={i}>
                        <div className="example-h">
                          <span>Example {i + 1}</span>
                          <button className="icon-btn" aria-label="Remove example" onClick={() => setBrief((b) => ({ ...b, examples: b.examples.filter((_, j) => j !== i) }))}>
                            {X}
                          </button>
                        </div>
                        <div className="row">
                          <textarea rows={3} value={ex.input} onChange={(e) => setEx(i, { input: e.target.value })} placeholder="Input" />
                          <textarea rows={3} value={ex.output} onChange={(e) => setEx(i, { output: e.target.value })} placeholder="Ideal output" />
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
                      <label>Inputs / assets</label>
                      <textarea rows={2} value={brief.inputs} onChange={(e) => set("inputs", e.target.value)} placeholder="Files, docs, keys, data available" />
                    </div>
                    <div className="field">
                      <label>Response format</label>
                      <textarea rows={2} value={brief.outputFormat} onChange={(e) => set("outputFormat", e.target.value)} placeholder="Final report shape, length, structure" />
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
                  <div className="row">
                    <div className="field">
                      <label>
                        Model <em>OpenRouter id</em>
                      </label>
                      <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder={server?.defaultModel || "deepseek/deepseek-v4.1-flash"} />
                    </div>
                    {server?.requiresAccessCode && (
                      <div className="field">
                        <label>Access code</label>
                        <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Required" />
                      </div>
                    )}
                  </div>
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
                </div>
                {!ready && <p className="note">Write an objective to continue.</p>}
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
                <button key={v.id} className={`ver ${v.id === active ? "on" : ""} ${v.missing.length ? "warn" : ""}`} onClick={() => setActive(v.id)} title={`${v.label} · ${v.model}`}>
                  v{v.id}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {busy === "repair" && <span className="meta">repairing contract…</span>}
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
              <span className="caret" />
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
                  onChange={(e) => setFeedback(e.target.value)}
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
      <p className="foot">Brief is saved locally in your browser. Prompts are generated server-side; nothing is stored.</p>
    </div>
  );
}
