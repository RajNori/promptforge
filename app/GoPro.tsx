"use client";
import { useState } from "react";
import { track } from "@vercel/analytics";

/**
 * Fake-door Pro button: payments aren't live yet, so a click records purchase intent and tells the person
 * honestly that Pro isn't open. Feeds the click-to-buy metric (/api/admin/metrics).
 */
export function GoPro({ source, price, className = "btn primary" }: { source: "pricing" | "menu" | "quota"; price: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [email, setEmail] = useState<string | null>(null);

  async function click() {
    setState("busy");
    try {
      track("pro_click", { source });
    } catch {
      /* analytics is best-effort */
    }
    try {
      const r = await fetch("/api/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
      const d = await r.json().catch(() => ({}));
      setEmail(d?.email ?? null);
    } catch {
      /* still show the message */
    }
    setState("done");
  }

  if (state === "done")
    return (
      <p className="note" role="status">
        Thanks — Pro isn&apos;t open yet, so you haven&apos;t been charged.{" "}
        {email ? <>We&apos;ll email {email} when it launches.</> : <><a href="/signin">Sign in</a> and we&apos;ll email you when it launches.</>}
      </p>
    );
  return (
    <button className={className} onClick={click} disabled={state === "busy"}>
      Go Pro — {price}/month
    </button>
  );
}
