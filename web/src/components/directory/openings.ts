import type { ProviderSlot } from "@/lib/api/types";
import { dayKey, daysUntilInstant, formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";

/** The soonest open time per provider; slots arrive soonest first from the API. */
export function firstOpenings(slots: ProviderSlot[]): Map<string, ProviderSlot> {
  const out = new Map<string, ProviderSlot>();
  for (const s of slots) if (!out.has(s.providerId)) out.set(s.providerId, s);
  return out;
}

/** "Today 2:00 PM", "Tomorrow 10:00 AM", "Tue 10:00 AM", then "Nov 24, 10:00 AM", in the families' Eastern time. */
export function openingLabel(iso: string, now: Date): string {
  const d = daysUntilInstant(iso, now);
  const clock = formatClock(iso);
  if (d <= 0) return `Today ${clock}`;
  if (d === 1) return `Tomorrow ${clock}`;
  if (d < 7) return `${formatWeekday(iso)} ${clock}`;
  return `${formatMonth(iso)} ${formatDayNumber(iso)}, ${clock}`;
}

/** Slots grouped by Eastern calendar day, in order. */
export function byDay<T extends { startsAt: string }>(slots: T[]): { key: string; first: string; items: T[] }[] {
  const days = new Map<string, T[]>();
  for (const s of slots) days.set(dayKey(s.startsAt), [...(days.get(dayKey(s.startsAt)) ?? []), s]);
  return [...days.entries()].map(([key, items]) => ({ key, first: items[0].startsAt, items }));
}
