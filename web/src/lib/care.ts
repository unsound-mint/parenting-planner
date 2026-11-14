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
  // Past a few hours the minutes are noise ("23 h 7 min ago" also overflowed the tile).
  if (h < 24) return min % 60 === 0 || h >= 3 ? `${h} h ago` : `${h} h ${min % 60} min ago`;
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

/**
 * When the next feed is likely, from the average gap between the last feeds in
 * the log. Needs three feeds; null otherwise. An estimate: babies do not keep a schedule.
 */
export function nextFeedEstimate(entries: CareLogEntry[]): string | null {
  const feeds = entries
    .filter((e) => e.kind === "feed")
    .map((e) => Date.parse(e.startedAt))
    .sort((a, b) => b - a)
    .slice(0, 6);
  if (feeds.length < 3) return null;
  const gaps = feeds.slice(0, -1).map((t, i) => t - feeds[i + 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return new Date(feeds[0] + mean).toISOString();
}

/** "1 h 35 min", "40 min". */
export function durationWords(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} h` : `${h} h ${min % 60} min`;
}

/** A breastfeed's side, or undefined for a bottle. */
export function breastSide(e?: CareLogEntry): "left" | "right" | "both" | undefined {
  switch (e?.feedMethod) {
    case "breast_left":
      return "left";
    case "breast_right":
      return "right";
    case "breast_both":
      return "both";
  }
  return undefined;
}

/** Hour (0 to 23) and minute of an instant on the Eastern clock. */
export function clockOf(iso: string | number): { h: number; m: number } {
  const parts = clockParts.formatToParts(new Date(iso));
  return { h: Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24, m: Number(parts.find((p) => p.type === "minute")?.value ?? 0) };
}

const wallParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/New_York",
});

/** "2026-11-15T14:05": an instant as Eastern wall time, for <input type="datetime-local">. */
export function toEasternInput(iso: string | number): string {
  const p = Object.fromEntries(wallParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** The instant of an Eastern wall time typed into a datetime-local input. */
export function fromEasternInput(value: string): string {
  const guess = Date.parse(`${value}:00Z`);
  // The wall time the guess shows in Eastern, read back as if it were UTC, gives the zone offset.
  const shown = Date.parse(`${toEasternInput(guess)}:00Z`);
  return new Date(guess + (guess - shown)).toISOString();
}
