"use client";

import { useCallback, useEffect, useState } from "react";
import { NICHD_RULE, ruleKey, timerKey, type CallRule, type Contraction } from "@/lib/labor";

// The contraction timer's state lives on this device only (localStorage, per
// family), never in the API: it is a tool for the moment, not a health record.
// Read after mount so the server render and the first client render agree.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full store: the timer still works for this visit.
  }
}

/** Keep at most a day of contractions; older ones are of no use to the rule or the bars. */
const KEEP_MS = 24 * 60 * 60_000;

export function useContractions(familyId: string) {
  const [list, setList] = useState<Contraction[]>([]);
  const [rule, setRuleState] = useState<CallRule | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setList(read<Contraction[]>(timerKey(familyId), []).filter((c) => now - c.start < KEEP_MS));
    setRuleState(read<CallRule | null>(ruleKey(familyId), null));
    setLoaded(true);
    // Another tab of the same family (both parents on one laptop) stays in step.
    const onStorage = (e: StorageEvent) => {
      if (e.key === timerKey(familyId)) setList(read(timerKey(familyId), []));
      if (e.key === ruleKey(familyId)) setRuleState(read(ruleKey(familyId), null));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [familyId]);

  const update = useCallback(
    (next: (prev: Contraction[]) => Contraction[]) =>
      setList((prev) => {
        const value = next(prev);
        write(timerKey(familyId), value);
        return value;
      }),
    [familyId],
  );

  const running = list.at(-1)?.end == null && list.length > 0;

  const tap = useCallback(() => {
    const now = Date.now();
    update((prev) => {
      const last = prev.at(-1);
      if (last && last.end == null) return [...prev.slice(0, -1), { ...last, end: now }];
      return [...prev.filter((c) => now - c.start < KEEP_MS), { start: now }];
    });
  }, [update]);

  const undo = useCallback(() => update((prev) => prev.slice(0, -1)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  const setRule = useCallback(
    (next: CallRule | null) => {
      setRuleState(next);
      if (next) write(ruleKey(familyId), next);
      else localStorage.removeItem(ruleKey(familyId));
    },
    [familyId],
  );

  return { list, running, tap, undo, clear, loaded, rule: rule ?? NICHD_RULE, customRule: rule != null, setRule };
}

/** Wall clock ticking every second; the rule, the bars and the live duration read it. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Keeps the screen on while timing (Screen Wake Lock API, where supported). The
 * browser drops the lock when the tab is hidden, so it is asked for again on return.
 */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        // Battery saver or a denied permission: timing works without it.
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [on]);
}
