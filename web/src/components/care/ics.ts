import type { PsychologistBooking } from "@/lib/api/types";

type IcsEvent = {
  id: string;
  title: string;
  /** ISO instant. For an all-day event only the date part counts. */
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const compactDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const nextDay = (iso: string) => compactDate(new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString());
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A calendar file the person can open anywhere. No server route involved. */
export function eventIcsHref(e: IcsEvent): string {
  const start = new Date(e.startsAt);
  const when = e.allDay
    ? [`DTSTART;VALUE=DATE:${compactDate(e.startsAt)}`, `DTEND;VALUE=DATE:${nextDay(e.startsAt)}`]
    : [`DTSTART:${stamp(start)}`, `DTEND:${stamp(e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 3_600_000))}`];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parenting Planner//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@parenting-planner`,
    `DTSTAMP:${stamp(new Date())}`,
    ...when,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** Google Calendar's "add event" page, filled in. It adds the event at once, no waiting for a sync. */
export function googleEventHref(e: IcsEvent): string {
  const dates = e.allDay
    ? `${compactDate(e.startsAt)}/${nextDay(e.startsAt)}`
    : `${stamp(new Date(e.startsAt))}/${stamp(e.endsAt ? new Date(e.endsAt) : new Date(Date.parse(e.startsAt) + 3_600_000))}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function icsHref(b: PsychologistBooking): string {
  return eventIcsHref({
    id: b.id,
    title: `Session with ${b.provider.name}`,
    startsAt: b.startsAt,
    endsAt: new Date(new Date(b.startsAt).getTime() + b.durationMinutes * 60_000).toISOString(),
  });
}
