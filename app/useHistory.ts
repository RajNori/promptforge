"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/forge";
import { MAX_UNPINNED_VERSIONS } from "@/lib/plans";

export type Version = { id: string; seq: number; label: string; text: string; missing: string[]; pinned: boolean };

const LOCAL_KEY = "pf:history:v1";

/** Keep every pinned version plus the newest N unpinned, ordered by seq. */
function prune(vs: Version[]): Version[] {
  const unpinned = vs.filter((v) => !v.pinned).sort((a, b) => b.seq - a.seq);
  const keep = new Set([...vs.filter((v) => v.pinned).map((v) => v.id), ...unpinned.slice(0, MAX_UNPINNED_VERSIONS).map((v) => v.id)]);
  return vs.filter((v) => keep.has(v.id)).sort((a, b) => a.seq - b.seq);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `Request failed (${r.status})`), { code: d.code, status: r.status });
  return d as T;
}

/**
 * Version history for the current prompt.
 * - Signed in (sync): stored per project in the database; first save creates the project.
 * - Guest: stored in this browser.
 */
export function useHistory(syncState: boolean | null, onError: (msg: string) => void) {
  // null = account status not known yet; don't load or persist anything until it is.
  const sync = syncState === true;
  const guest = syncState === false;
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const seq = useRef(0);
  const creating = useRef<Promise<string | null> | null>(null);

  // Guest history: restore once, persist on change.
  useEffect(() => {
    if (!guest) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const vs = (JSON.parse(raw) as Version[]).filter((v) => v && typeof v.text === "string");
        setVersions(prune(vs));
        seq.current = Math.max(0, ...vs.map((v) => v.seq));
        if (vs.length) setActiveId(vs[vs.length - 1].id);
      }
    } catch {}
  }, [guest]);

  useEffect(() => {
    if (!guest) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(versions));
    } catch {}
  }, [versions, guest]);

  const ensureProject = useCallback(
    async (brief: Brief): Promise<string | null> => {
      if (!sync) return null;
      if (projectId) return projectId;
      if (!creating.current) {
        creating.current = api<{ id: string }>("/api/projects", { method: "POST", body: JSON.stringify({ brief }) })
          .then((p) => {
            setProjectId(p.id);
            return p.id;
          })
          .catch((e) => {
            onError(e.message);
            return null;
          })
          .finally(() => {
            creating.current = null;
          });
      }
      return creating.current;
    },
    [sync, projectId, onError],
  );

  /** Add a version, or replace `replaceId` (auto-fixes overwrite the attempt they fixed). Returns the version id. */
  const save = useCallback(
    async (brief: Brief, text: string, label: string, missing: string[], replaceId?: string): Promise<string> => {
      const local: Version = replaceId
        ? { ...(versions.find((v) => v.id === replaceId) as Version), text, label, missing }
        : { id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, seq: ++seq.current, label, text, missing, pinned: false };

      // Optimistic update.
      setVersions((vs) => prune(replaceId ? vs.map((v) => (v.id === replaceId ? local : v)) : [...vs, local]));
      setActiveId(local.id);
      if (!sync) return local.id;

      const pid = await ensureProject(brief);
      if (!pid) return local.id;
      try {
        const serverReplace = replaceId && !replaceId.startsWith("local-") ? replaceId : undefined;
        const v = await api<Version>(`/api/projects/${pid}/versions`, {
          method: "POST",
          body: JSON.stringify({ label, text, missing, replaceId: serverReplace }),
        });
        seq.current = Math.max(seq.current, v.seq);
        setVersions((vs) => prune(vs.map((x) => (x.id === local.id ? { ...v } : x))));
        setActiveId((a) => (a === local.id ? v.id : a));
        return v.id;
      } catch (e) {
        onError(`Not saved to your library: ${(e as Error).message}`);
        return local.id;
      }
    },
    [versions, sync, ensureProject, onError],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const v = versions.find((x) => x.id === id);
      if (!v) return;
      const pinned = !v.pinned;
      if (pinned && versions.filter((x) => x.pinned).length >= 10) return onError("Up to 10 pinned versions per prompt.");
      setVersions((vs) => prune(vs.map((x) => (x.id === id ? { ...x, pinned } : x))));
      if (sync && projectId && !id.startsWith("local-")) {
        api(`/api/projects/${projectId}/versions/${id}`, { method: "PATCH", body: JSON.stringify({ pinned }) }).catch((e) => onError(e.message));
      }
    },
    [versions, sync, projectId, onError],
  );

  const clear = useCallback(async () => {
    setVersions((vs) => vs.filter((v) => v.pinned));
    setActiveId((a) => (versions.find((v) => v.id === a)?.pinned ? a : versions.filter((v) => v.pinned).at(-1)?.id ?? null));
    if (sync && projectId) api(`/api/projects/${projectId}/versions`, { method: "DELETE" }).catch((e) => onError(e.message));
  }, [versions, sync, projectId, onError]);

  /** Start a fresh prompt (new project on next save). */
  const reset = useCallback(() => {
    setVersions([]);
    setActiveId(null);
    setProjectId(null);
    seq.current = 0;
  }, []);

  /** Capture / restore the whole history state (powers Undo after "New"). */
  const snapshot = useCallback(() => ({ versions, activeId, projectId, seq: seq.current }), [versions, activeId, projectId]);
  const restore = useCallback((snap: { versions: Version[]; activeId: string | null; projectId: string | null; seq: number }) => {
    setVersions(snap.versions);
    setActiveId(snap.activeId);
    setProjectId(snap.projectId);
    seq.current = snap.seq;
  }, []);

  /** Load a saved project; returns its brief. */
  const open = useCallback(async (id: string): Promise<Brief | null> => {
    try {
      const p = await api<{ id: string; brief: Brief; versions: Version[] }>(`/api/projects/${id}`);
      setProjectId(p.id);
      setVersions(prune(p.versions));
      seq.current = Math.max(0, ...p.versions.map((v) => v.seq));
      setActiveId(p.versions.at(-1)?.id ?? null);
      return p.brief;
    } catch (e) {
      onError((e as Error).message);
      return null;
    }
  }, [onError]);

  return { versions, activeId, setActiveId, projectId, save, togglePin, clear, reset, open, snapshot, restore };
}

/** Debounced brief sync for an open project. */
export function useBriefSync(projectId: string | null, brief: Brief) {
  const last = useRef<string>("");
  useEffect(() => {
    if (!projectId) return;
    const body = JSON.stringify({ brief, title: brief.objective });
    if (body === last.current) return;
    const t = setTimeout(() => {
      last.current = body;
      fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [projectId, brief]);
}
