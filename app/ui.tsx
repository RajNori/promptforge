"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FIELD_HELP, type FieldHelp } from "@/lib/help";
import { FRAMEWORKS, TARGETS, autoPick } from "@/lib/forge";
import { PERSONAS, defaultProfile, persona as personaOf, templatesFor, type PersonaId, type Profile, type Template } from "@/lib/personas";

/** Hover/focus tooltip with guidance, a good example, and what to avoid. */
export function Tip({ help }: { help: FieldHelp }) {
  const id = useId();
  return (
    <span className="tip">
      <button type="button" className="tip-btn" aria-describedby={id} aria-label={`${help.label} tips`}>
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v4M8 4.9v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span role="tooltip" id={id} className="tip-pop">
        <span className="tip-text">{help.tip}</span>
        <span className="tip-row good">
          <b>Good</b>
          <span>{help.good}</span>
        </span>
        {help.avoid && (
          <span className="tip-row avoid">
            <b>Avoid</b>
            <span>{help.avoid}</span>
          </span>
        )}
      </span>
    </span>
  );
}

const STAR = (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
    <path d="M8 1.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5 2.9-.4 4.1-1.6 4.5-4.5z" fill="currentColor" />
    <path d="M12.6 10.2c.2 1.3.7 1.8 2 2-1.3.2-1.8.7-2 2-.2-1.3-.7-1.8-2-2 1.3-.2 1.8-.7 2-2z" fill="currentColor" opacity=".7" />
  </svg>
);

/** AI fill/improve button for a single field. */
export function Sparkle({ filled, loading, disabled, onClick, label }: { filled: boolean; loading: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  const title = disabled ? "Add an objective or context first" : filled ? `Improve ${label} with AI` : `Fill ${label} with AI`;
  return (
    <button type="button" className={`spark ${loading ? "busy" : ""}`} onClick={onClick} disabled={disabled || loading} title={title} aria-label={title}>
      {STAR}
    </button>
  );
}

export const StarIcon = STAR;

/** Field label row: label · tooltip … hint · sparkle. */
export function FieldLabel({
  field,
  label,
  hint,
  required,
  spark,
}: {
  field?: keyof typeof FIELD_HELP;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  spark?: ReactNode;
}) {
  return (
    <div className="flabel">
      <span className="flabel-l">
        {label}
        {required && <span className="req">*</span>}
        {field && <Tip help={FIELD_HELP[field]} />}
      </span>
      <span className="flabel-r">
        {hint && <em>{hint}</em>}
        {spark}
      </span>
    </div>
  );
}

const GOAL_LABEL = (t: Template) => personaOf(t.persona).goals.find((g) => g.id === t.goal)?.label ?? "More";

/** Persona-aware template picker: your role first (your goals on top), every other role browsable. */
export function TemplateMenu({ onPick, profile, onPersona }: { onPick: (t: Template) => void; profile: Profile | null; onPersona: (id: PersonaId) => void }) {
  const [open, setOpen] = useState(false);
  const who: PersonaId = profile?.persona ?? "general";
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = templatesFor(profile ?? defaultProfile(who));
  const groups: { label: string; items: Template[] }[] = [];
  for (const t of list) {
    const label = GOAL_LABEL(t);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(t);
    else groups.push({ label, items: [t] });
  }
  const pick = (t: Template) => {
    onPick(t);
    setOpen(false);
  };

  return (
    <div className="exm" ref={root}>
      <button className="btn ghost sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Templates
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden className="chev">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="exm-pop" role="menu">
          <div className="exm-who">
            <select aria-label="I'm a" value={who} onChange={(e) => onPersona(e.target.value as PersonaId)}>
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button className="exm-random" role="menuitem" onClick={() => list.length && pick(list[Math.floor(Math.random() * list.length)])}>
            {STAR} Surprise me
          </button>
          {groups.map((g) => (
            <div key={g.label} className="exm-group">
              <div className="exm-h">{g.label}</div>
              {g.items.map((t) => {
                const fw = FRAMEWORKS[t.brief.framework && t.brief.framework !== "auto" ? t.brief.framework : autoPick(t.brief.target ?? "chat-llm", t.brief.taskType)];
                return (
                  <button key={t.id} role="menuitem" className="exm-item" onClick={() => pick(t)}>
                    <span>{t.name}</span>
                    <small>
                      {t.persona === "developer" ? `${TARGETS.find((x) => x.id === t.brief.target)?.label} · ` : ""}
                      {fw.name}
                      {t.brief.chain ? " · chain" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Empty-state starter cards. */
export function TemplateStrip({ profile, onPick }: { profile: Profile | null; onPick: (t: Template) => void }) {
  const items = templatesFor(profile).slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="tstrip">
      <div className="tstrip-h">
        <b>Start from a template</b>
        <small>{profile ? `Picked for ${personaOf(profile.persona).label.toLowerCase()}s` : "Popular starting points"} — or write your own below</small>
      </div>
      <div className="tstrip-grid">
        {items.map((t) => (
          <button key={t.id} className="tcard" onClick={() => onPick(t)}>
            <span>{t.name}</span>
            <small>{GOAL_LABEL(t)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
