import { CalendarClock, Droplet, HandHeart, Milk, MoonStar, type LucideIcon } from "lucide-react";
import type { CareLogEntry, Today } from "@/lib/api/types";
import { daysUntilInstant, formatClock, whenWords } from "@/lib/format";
import { roleAccent } from "@/lib/visuals";

// What a grandparent or nanny does next: their shift, who has the baby, the
// last feed, sleep and diaper, and handoffs waiting for them. Every section
// renders only when Today returned it, which the API does by role and permission.
export function CaregiverToday({ today, names }: { today: Today; names: Record<string, string> }) {
  const { nextShift, careSummary, pendingHandoffs } = today;
  const onDuty = careSummary?.onDuty;
  const last: { icon: LucideIcon; label: string; entry?: CareLogEntry }[] = [
    { icon: Milk, label: "Last feed", entry: careSummary?.lastFeed },
    { icon: MoonStar, label: "Last sleep", entry: careSummary?.lastSleep },
    { icon: Droplet, label: "Last diaper", entry: careSummary?.lastDiaper },
  ];
  const entries = last.filter((l) => l.entry);
  if (!nextShift && !onDuty && entries.length === 0 && pendingHandoffs.length === 0) return null;

  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-4">
      <h2 id="today-title" className="sr-only">
        Today
      </h2>

      {pendingHandoffs.map((h) => (
        <div key={h.id} className="flex items-center gap-3 rounded-2xl border border-primary bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-due-soft text-status-due">
            <HandHeart className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-title">Handoff from {names[h.fromMemberId] ?? "a parent"}</p>
            {h.note && <p className="text-label text-muted-foreground">{h.note}</p>}
          </div>
        </div>
      ))}

      {(nextShift || onDuty) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {onDuty && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-label text-muted-foreground">Who has the baby</p>
              <p className="mt-1 text-title">{onDuty.memberId === today.memberId ? "You" : (names[onDuty.memberId] ?? "A parent")}</p>
              <p className="font-mono text-caption text-muted-foreground">since {formatClock(onDuty.since)}</p>
            </div>
          )}
          {nextShift && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-muted ${roleAccent.nanny.text}`}>
                <CalendarClock className="size-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-label text-muted-foreground">Your next shift</p>
                <p className="text-title">{nextShift.title}</p>
                <p className="font-mono text-caption text-muted-foreground">
                  {whenWords(daysUntilInstant(nextShift.startsAt))} · {formatClock(nextShift.startsAt)}
                  {nextShift.endsAt && ` to ${formatClock(nextShift.endsAt)}`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {entries.map(({ icon: Icon, label, entry }) => (
            <li key={label} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 text-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-status-up-soft text-status-up">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span className="text-label">{label}</span>
              <span className="font-mono text-caption text-muted-foreground">{formatClock(entry!.startedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
