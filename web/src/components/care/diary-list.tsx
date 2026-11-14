import type { DiaryEntry } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { careIcon, visibilityIcon } from "@/lib/visuals";

const audienceWord: Record<DiaryEntry["visibility"], string> = {
  private: "Only you",
  partner: "Shared with your partner",
  care_team: "Topic on your agenda",
  family: "Shared with your family",
};

// The parent's own recent entries. The visibility icon is the first thing to
// read: who can see this entry.
export function DiaryList({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) {
    return (
      <section aria-labelledby="entries-title" className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-5">
        <careIcon.diary className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 id="entries-title" className="text-label font-semibold">
            Your entries
          </h2>
          <p className="text-label text-muted-foreground">Nothing written yet. The first line is the hardest.</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="entries-title">
      <h2 id="entries-title" className="text-title">
        Your recent entries
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {entries.slice(0, 5).map((e) => {
          const Icon = visibilityIcon[e.visibility];
          return (
            <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{audienceWord[e.visibility]}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-body">{e.body}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  <time dateTime={e.writtenAt} className="font-mono">
                    {formatShortDate(e.writtenAt)}
                  </time>
                  {e.agendaTopic ? <span>Agenda: {e.agendaTopic}</span> : <span>{audienceWord[e.visibility]}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
