"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/personas";
import { parseProfile } from "@/lib/profile";
import type { Me } from "./Account";

const KEY = "pf:profile";
const SKIP = "pf:onboarding-skipped";

const readLocal = (): Profile | null => {
  try {
    return parseProfile(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return null;
  }
};

const put = (p: Profile) =>
  fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }).catch(() => {});

/**
 * Onboarding profile. Signed in: stored on the user (a browser-only profile is pushed up on first sign-in).
 * Guest: stored in this browser.
 */
export function useProfile(me: Me | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const synced = useRef(false);
  const hydratedFor = useRef<string | null>(null);

  // Hydrate once per identity. /api/me refreshes after every AI call; re-reading it here
  // would clobber a change the user just made while its PUT is still in flight.
  useEffect(() => {
    if (!me) return;
    const who = me.user?.email ?? "guest";
    if (hydratedFor.current === who) return;
    hydratedFor.current = who;
    const local = readLocal();
    if (me.user && me.profile) setProfile(me.profile);
    else setProfile(local);
    if (me.user && !me.profile && local && !synced.current) {
      synced.current = true;
      put(local);
    }
    try {
      setSkipped(localStorage.getItem(SKIP) === "1");
    } catch {}
    setLoaded(true);
  }, [me]);

  const save = useCallback(
    (p: Profile) => {
      setProfile(p);
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
      } catch {}
      if (me?.user) put(p);
    },
    [me?.user],
  );

  const skip = useCallback(() => {
    setSkipped(true);
    try {
      localStorage.setItem(SKIP, "1");
    } catch {}
  }, []);

  return { profile, save, skip, needsOnboarding: loaded && !profile && !skipped };
}
