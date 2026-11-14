import type { CalendarEvent, Shift, ShiftSuggestion, Weekday } from "@/lib/api/types";
import { dayKey } from "@/lib/format";

// Helpers for the calendar and the shift commit. Dates are plain
// YYYY-MM-DD strings in Eastern time, like the rest of lib/format.ts.

export const weekdays: { id: Weekday; short: string; long: string }[] = [
  { id: "mon", short: "Mon", long: "Monday" },
  { id: "tue", short: "Tue", long: "Tuesday" },
  { id: "wed", short: "Wed", long: "Wednesday" },
  { id: "thu", short: "Thu", long: "Thursday" },
  { id: "fri", short: "Fri", long: "Friday" },
  { id: "sat", short: "Sat", long: "Saturday" },
  { id: "sun", short: "Sun", long: "Sunday" },
];

export function todayKey(now: Date): string {
  return dayKey(now.toISOString());
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven day keys of a week starting at `from`. */
export function weekKeys(from: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

/** The calendar day an event belongs to. All-day events carry a date, not an instant. */
export function eventDay(e: Pick<CalendarEvent, "startsAt" | "allDay">): string {
  return e.allDay ? e.startsAt.slice(0, 10) : dayKey(e.startsAt);
}

/** "22:00" to "10 PM", "07:30" to "7:30 AM". */
export function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "10 PM to 2 AM". */
export function shiftTimes(s: Pick<ShiftSuggestion, "startTime" | "endTime">): string {
  return `${clock12(s.startTime)} to ${clock12(s.endTime)}`;
}

/** "Every day", "Weekdays", "Mon, Wed, Fri". */
export function dayWords(days: Weekday[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && weekdays.slice(0, 5).every((d) => set.has(d.id))) return "Weekdays";
  if (set.size === 2 && set.has("sat") && set.has("sun")) return "Weekends";
  return weekdays.filter((d) => set.has(d.id)).map((d) => d.short).join(", ");
}

export type ShiftLike = Pick<Shift, "title" | "days" | "startTime" | "endTime">;

// Late pregnancy starts here for the "Baby is home" switch. The seeded pregnancy
// family is in week 25 and the demo flips it, so the switch shows from week 24. Raise it after the demo.
export const LATE_PREGNANCY_WEEK = 24;

/** "10:30 AM to 11:15 AM" as "10:30-11:15 AM"; "10:00 PM to 2:00 AM" as "10 PM-2 AM". Keeps narrow day columns on one line. */
export function compactRange(startClock: string, endClock?: string): string {
  const part = (c: string) => {
    const [t, ap] = c.split(" ");
    return { t: t.replace(":00", ""), ap };
  };
  const a = part(startClock);
  if (!endClock) return `${a.t} ${a.ap}`;
  const b = part(endClock);
  return a.ap === b.ap ? `${a.t}\u2013${b.t} ${b.ap}` : `${a.t} ${a.ap}\u2013${b.t} ${b.ap}`;
}

const ZONE = "America/New_York";
const zoneParts = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function zoneOffsetMs(utc: number): number {
  const p = Object.fromEntries(zoneParts.formatToParts(new Date(utc)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(utc / 60_000) * 60_000;
}

/** An Eastern wall-clock date and time ("2026-11-20", "09:30") as an ISO instant. */
export function easternInstant(date: string, hhmm: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - zoneOffsetMs(wall);
  utc = wall - zoneOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** The Eastern time of day of an instant, "09:30", for a time input. */
export function easternClock(iso: string): string {
  const p = Object.fromEntries(zoneParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute}`;
}

/** Kinds a parent adds and edits by hand; shifts, tasks and psychologist sessions come from elsewhere. */
export type StoredKind = "appointment" | "class" | "reminder" | "other";
export const storedKinds: StoredKind[] = ["appointment", "class", "reminder", "other"];
export const isStoredKind = (k: CalendarEvent["kind"]): k is StoredKind => (storedKinds as string[]).includes(k);
