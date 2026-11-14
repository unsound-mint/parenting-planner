import type { PsychologistBooking } from "@/lib/api/types";

/** A calendar file the parent can open anywhere. No server route involved. */
export function icsHref(b: PsychologistBooking): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parenting Planner//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@parenting-planner`,
    `DTSTAMP:${stamp(start)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:Session with ${b.provider.name}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
