import type { CareLogEntry } from "@/lib/api/types";
import { dayKey } from "@/lib/format";

// Care log time helpers. Everything is drawn in Eastern time like the rest of
// the app (lib/format.ts), so server and browser agree.

const clockParts = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
  timeZone: "America/New_York",
});

/** Position of an instant inside its Eastern calendar day, 0 to 1. */
export function dayFraction(iso: string | number): number {
  const parts = clockParts.formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h * 60 + m) / (24 * 60);
}

export function isToday(iso: string, now = new Date()): boolean {
  return dayKey(iso) === dayKey(now.toISOString());
}

/** "just now", "35 min ago", "2 h 10 min ago", "1 day ago". */
export function agoWords(iso: string, now = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 === 0 ? `${h} h ago` : `${h} h ${min % 60} min ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** The instant an entry counts from: a sleep that is over counts from its end. */
export function lastActivityAt(e: CareLogEntry): string {
  return e.kind === "sleep" && e.endedAt ? e.endedAt : e.startedAt;
}

/** A sleep with no end is still going. */
export function isAsleep(e?: CareLogEntry): boolean {
  return !!e && e.kind === "sleep" && !e.endedAt;
}
