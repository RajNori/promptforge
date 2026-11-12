"use client";

import { useEffect, useRef, useState } from "react";
import type { MissingDetail } from "@/lib/forge";

/**
 * Last step before forging: the concrete facts the result needs that only the user knows (names, dates, venue…).
 * All optional. Filled ones are added to the brief; Skip forges as-is (the prompt then uses neutral wording, never guesses).
 * Reuses the onboarding dialog and clarify-question styles, no new CSS.
 */
export function MissingDetails({
  details,
  busy,
  onSubmit,
  onSkip,
}: {
  details: MissingDetail[];
  busy: boolean;
  onSubmit: (filled: { label: string; value: string }[]) => void;
  onSkip: () => void;
}) {
  const [values, setValues] = useState<string[]>(() => details.map(() => ""));
  const dialog = useRef<HTMLDivElement>(null);
  const filled = values.filter((v) => v.trim()).length;
  const submit = () => onSubmit(details.map((d, i) => ({ label: d.label, value: values[i] ?? "" })));

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("input")?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onSkip();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSkip, busy]);

  return (
    <div className="ob-scrim">
      <div className="ob" role="dialog" aria-modal="true" aria-labelledby="md-title" ref={dialog}>
        <h2 id="md-title">Add the details only you know</h2>
        <p className="note">All optional. Anything you add goes straight into your prompt, so the result comes back complete. Leave any blank and it&apos;s worded generally instead of guessed.</p>
        {details.map((d, i) => (
          <div className="q" key={i}>
            <p>{d.label}</p>
            <input
              type="text"
              value={values[i]}
              maxLength={200}
              onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => e.key === "Enter" && i === details.length - 1 && !busy && submit()}
              placeholder={d.hint ? `e.g. ${d.hint}` : "Leave blank to skip"}
            />
          </div>
        ))}
        <div className="ob-actions">
          <button className="btn ghost" disabled={busy} onClick={onSkip}>
            Skip, forge as is
          </button>
          <button className="btn primary" disabled={busy} onClick={submit}>
            {filled ? `Add ${filled} detail${filled > 1 ? "s" : ""} & forge →` : "Forge →"}
          </button>
        </div>
      </div>
    </div>
  );
}
