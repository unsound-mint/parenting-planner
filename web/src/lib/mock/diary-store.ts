"use client";

import { useSyncExternalStore } from "react";
import type { AgendaTopic, DiaryEntry } from "@/lib/api/types";

// Browser-side memory for the diary while its endpoints still answer 501.
// The preview mocks run per request and store nothing, so without this a saved
// entry and its agenda topic would vanish on the next page load. Entries are
// kept per acting member in sessionStorage and only ever written for answers
// that came from a mock (isPreviewMock). Once the real API stores them it
// returns the entries itself and this file stays empty.

const KEY = "pp-mock-diary";
const EMPTY: DiaryEntry[] = [];
const listeners = new Set<() => void>();
let rawCache: string | null = null;
let parsed: Record<string, DiaryEntry[]> = {};

function read(): Record<string, DiaryEntry[]> {
  const raw = sessionStorage.getItem(KEY);
  if (raw !== rawCache) {
    rawCache = raw;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
  }
  return parsed;
}

function emit() {
  for (const l of listeners) l();
}

/** Remember an entry the mock accepted (new or changed). */
export function rememberMockEntry(memberId: string, entry: DiaryEntry) {
  const all = read();
  const rest = (all[memberId] ?? []).filter((e) => e.id !== entry.id);
  sessionStorage.setItem(KEY, JSON.stringify({ ...all, [memberId]: [entry, ...rest] }));
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Entries the mock accepted in this browser session; empty on the server and on the first render. */
export function useMockDiary(memberId: string): DiaryEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => read()[memberId] ?? EMPTY,
    () => EMPTY,
  );
}

/** Server list with the remembered entries applied: changed ones replace, new ones come first, newest first. */
export function mergeDiary(server: DiaryEntry[], remembered: DiaryEntry[]): DiaryEntry[] {
  if (remembered.length === 0) return server;
  const byId = new Map(remembered.map((e) => [e.id, e]));
  const merged = [...server.map((e) => byId.get(e.id) ?? e), ...remembered.filter((e) => !server.some((s) => s.id === e.id))];
  return merged.sort((a, b) => b.writtenAt.localeCompare(a.writtenAt));
}

const LOCAL_PREFIX = "local-";
export const isLocalTopic = (id: string) => id.startsWith(LOCAL_PREFIX);

/**
 * Topics for remembered entries that the server agenda does not carry. Only the
 * short topic is used, never the entry text. The ids are local: the real
 * agenda has never heard of them, so they are never sent to it.
 */
export function localTopics(server: AgendaTopic[], remembered: DiaryEntry[]): AgendaTopic[] {
  return remembered
    .filter((e) => e.agendaTopic && !server.some((t) => t.diaryEntryId === e.id))
    .map((e) => ({ id: LOCAL_PREFIX + e.id, text: e.agendaTopic as string, addedAt: e.writtenAt, diaryEntryId: e.id }));
}
