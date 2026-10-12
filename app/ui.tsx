"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FIELD_HELP, type FieldHelp } from "@/lib/help";
import { EXAMPLES, type ExampleBrief } from "@/lib/examples";
import { FRAMEWORKS, TARGETS, TASK_TYPES, autoPick } from "@/lib/forge";

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

/** Grouped example picker. */
export function ExampleMenu({ onPick, currentType }: { onPick: (ex: ExampleBrief) => void; currentType: string }) {
  const [open, setOpen] = useState(false);
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

  // Current task type first, then the rest in canonical order.
  const order = [currentType, ...TASK_TYPES.filter((t) => t !== currentType)];
  const groups = order.map((t) => ({ type: t, items: EXAMPLES.filter((e) => e.brief.taskType === t) })).filter((g) => g.items.length);

  const pick = (ex: ExampleBrief) => {
    onPick(ex);
    setOpen(false);
  };

  return (
    <div className="exm" ref={root}>
      <button className="btn ghost sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Examples
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden className="chev">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="exm-pop" role="menu">
          <button className="exm-random" role="menuitem" onClick={() => pick(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}>
            {STAR} Surprise me
          </button>
          {groups.map((g) => (
            <div key={g.type} className="exm-group">
              <div className="exm-h">{g.type}</div>
              {g.items.map((ex) => {
                const fw = FRAMEWORKS[ex.brief.framework && ex.brief.framework !== "auto" ? ex.brief.framework : autoPick(ex.brief.target, ex.brief.taskType)];
                return (
                  <button key={ex.id} role="menuitem" className="exm-item" onClick={() => pick(ex)}>
                    <span>{ex.name}</span>
                    <small>
                      {TARGETS.find((t) => t.id === ex.brief.target)?.label} · {fw.name}
                      {ex.brief.chain ? " · chain" : ""}
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
