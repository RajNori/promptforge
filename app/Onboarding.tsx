"use client";

import { useEffect, useRef, useState } from "react";
import { LEVELS, PERSONAS, TOOLS, defaultProfile, modeFor, persona as personaOf, type Level, type PersonaId, type Profile, type Tool } from "@/lib/personas";

const STEPS = ["Role", "Goals", "Tool", "Experience"] as const;

/** First-visit setup: role → goals → where you use AI → experience. Skippable; re-openable. */
export function Onboarding({ initial, onDone, onSkip }: { initial: Profile | null; onDone: (p: Profile) => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(initial ?? { ...defaultProfile(), persona: "" as PersonaId });
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("button.ob-card, button.ob-chip")?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onSkip();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const per = personaOf(p.persona || undefined);
  const pickPersona = (id: PersonaId) => {
    const d = defaultProfile(id);
    // Keep goals only if the persona didn't change.
    setP((cur) => ({ ...cur, persona: id, goals: cur.persona === id ? cur.goals : [], tool: cur.persona ? cur.tool : d.tool, level: cur.persona ? cur.level : d.level }));
    setStep(1);
  };
  const toggleGoal = (g: string) => setP((cur) => ({ ...cur, goals: cur.goals.includes(g) ? cur.goals.filter((x) => x !== g) : [...cur.goals, g].slice(0, 8) }));
  const finish = (level: Level = p.level) => onDone({ ...p, level, mode: modeFor(level, p.persona) });

  return (
    <div className="ob-scrim">
      <div className="ob" role="dialog" aria-modal="true" aria-labelledby="ob-title" ref={dialog}>
        <div className="ob-top">
          <ol className="ob-steps" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
                <button type="button" disabled={i > step || (i > 0 && !p.persona)} onClick={() => setStep(i)}>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <button className="btn ghost sm" onClick={onSkip}>
            Skip
          </button>
        </div>

        {step === 0 && (
          <>
            <h2 id="ob-title">What do you do?</h2>
            <p className="note">We&apos;ll tailor examples, templates and defaults. Change it any time.</p>
            <div className="ob-grid">
              {PERSONAS.map((x) => (
                <button key={x.id} className={`ob-card ${p.persona === x.id ? "on" : ""}`} onClick={() => pickPersona(x.id)}>
                  <b>{x.label}</b>
                  <small>{x.blurb}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="ob-title">What will you use it for?</h2>
            <p className="note">Pick any that apply — these go to the top of your templates.</p>
            <div className="ob-chips">
              {per.goals.map((g) => (
                <button key={g.id} className={`ob-chip ${p.goals.includes(g.id) ? "on" : ""}`} aria-pressed={p.goals.includes(g.id)} onClick={() => toggleGoal(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button className="btn ghost" onClick={() => setStep(0)}>
                ← Back
              </button>
              <button className="btn primary" onClick={() => setStep(2)}>
                {p.goals.length ? "Next →" : "Skip this →"}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="ob-title">Where will you paste your prompts?</h2>
            <p className="note">Prompts are shaped for the tool you use.</p>
            <div className="ob-grid tools">
              {TOOLS.map((t) => (
                <button key={t.id} className={`ob-card ${p.tool === t.id ? "on" : ""}`} onClick={() => (setP((cur) => ({ ...cur, tool: t.id as Tool })), setStep(3))}>
                  <b>{t.label}</b>
                  <small>{t.hint}</small>
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button className="btn ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 id="ob-title">How comfortable are you with AI prompts?</h2>
            <p className="note">Sets how many controls you see. Switch between Simple and Advanced any time.</p>
            <div className="ob-grid tools">
              {LEVELS.map((l) => (
                <button key={l.id} className={`ob-card ${p.level === l.id ? "on" : ""}`} onClick={() => finish(l.id)}>
                  <b>{l.label}</b>
                  <small>{l.hint}</small>
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button className="btn ghost" onClick={() => setStep(2)}>
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
