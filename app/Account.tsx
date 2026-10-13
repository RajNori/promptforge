"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doSignOut } from "./actions";

export type Me = {
  user: { name: string | null; email: string | null; image: string | null } | null;
  plan: "ANON" | "FREE" | "PRO";
  planName: string;
  period: "day" | "month";
  usage: { used: number; limit: number; resetsAt: string | null; metered: boolean };
  sync: boolean;
  auth: { enabled: boolean; providers: string[] };
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, []);
  useEffect(() => refresh(), [refresh]);
  return { me, refresh };
}

function Meter({ me }: { me: Me }) {
  if (!me.usage.metered) return null;
  const { used, limit } = me.usage;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone = pct >= 100 ? "bad" : pct >= 80 ? "warn" : "";
  return (
    <a className={`meter ${tone}`} href="/pricing" title={`${used} of ${limit} AI generations used ${me.period === "day" ? "today" : "this month"}`}>
      <span className="meter-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span>
        {Math.max(0, limit - used)} left{me.period === "day" ? " today" : ""}
      </span>
    </a>
  );
}

type ProjectRow = { id: string; title: string; updatedAt: string; versions: number };

export function AccountBar({ me, onOpenProject, onNewProject }: { me: Me | null; onOpenProject: (id: string) => void; onNewProject: () => void }) {
  const [menu, setMenu] = useState(false);
  const [lib, setLib] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const loadLib = useCallback(() => {
    setProjects(null);
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this saved prompt and its versions?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((ps) => ps?.filter((p) => p.id !== id) ?? null);
  }

  if (!me) return <div className="acct" />;

  return (
    <div className="acct" ref={root}>
      <Meter me={me} />
      {me.user ? (
        <>
          <button className="btn ghost sm" onClick={() => (setLib(true), loadLib())}>
            Library
          </button>
          <button className="avatar" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} title={me.user.email ?? ""}>
            {me.user.image ? <img src={me.user.image} alt="" referrerPolicy="no-referrer" /> : <span>{(me.user.name ?? me.user.email ?? "?")[0]?.toUpperCase()}</span>}
          </button>
          {menu && (
            <div className="acct-menu" role="menu">
              <div className="acct-who">
                <b>{me.user.name ?? "Signed in"}</b>
                <small>{me.user.email}</small>
                <span className={`plan-tag ${me.plan.toLowerCase()}`}>{me.planName}</span>
              </div>
              <a role="menuitem" href="/pricing">
                {me.plan === "PRO" ? "Plan & billing" : "Upgrade to Pro"}
              </a>
              <form action={doSignOut}>
                <button role="menuitem" type="submit">Sign out</button>
              </form>
            </div>
          )}
        </>
      ) : me.auth.enabled ? (
        <a className="btn primary sm" href="/signin">
          Sign in
        </a>
      ) : null}

      {lib && (
        <div className="drawer-scrim" onClick={() => setLib(false)}>
          <aside className="drawer" role="dialog" aria-label="Your prompts" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-h">
              <b>Your prompts</b>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn primary sm" onClick={() => (onNewProject(), setLib(false))}>
                  New prompt
                </button>
                <button className="btn ghost sm" onClick={() => setLib(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>
            {projects === null ? (
              <p className="note">Loading…</p>
            ) : projects.length === 0 ? (
              <p className="note">Nothing saved yet. Generate a prompt and it&apos;s saved here automatically.</p>
            ) : (
              <ul className="proj-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button className="proj" onClick={() => (onOpenProject(p.id), setLib(false))}>
                      <span>{p.title}</span>
                      <small>
                        {p.versions} version{p.versions === 1 ? "" : "s"} · {new Date(p.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </small>
                    </button>
                    <button className="icon-btn" aria-label={`Delete ${p.title}`} onClick={() => del(p.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
