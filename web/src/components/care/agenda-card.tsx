import { Circle, Lock } from "lucide-react";
import type { AgendaTopic } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { careIcon } from "@/lib/visuals";

// Topics for the next session, built from diary entries the parent chose to
// add. Topics only: the entry text never reaches the agenda.
export function AgendaCard({ topics }: { topics: AgendaTopic[] }) {
  const Agenda = careIcon.agenda;
  return (
    <section aria-labelledby="agenda-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Agenda className="size-4.5" aria-hidden />
        </span>
        <h2 id="agenda-title" className="flex-1 text-title">
          To bring to your psychologist
        </h2>
        <span className="font-mono text-title tabular-nums" aria-label={`${topics.length} topics`}>
          {topics.length}
        </span>
      </div>

      {topics.length === 0 ? (
        <p className="mt-4 text-label text-muted-foreground">
          Nothing yet. When a diary entry is on your mind, add its topic to the agenda and it shows up here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {topics.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg px-1 py-2">
              <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 text-body">{t.text}</span>
              <time dateTime={t.addedAt} className="shrink-0 pt-0.5 font-mono text-caption text-muted-foreground">
                {formatShortDate(t.addedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Topics only, never your full entries. Your partner cannot see this list.
      </p>
    </section>
  );
}
