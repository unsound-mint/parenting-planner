import { Check, CircleAlert, Clock } from "lucide-react";
import type { VaccineDose, VaccineStatus } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { EmptyLine, SectionCard } from "./section-card";

const dot: Record<VaccineStatus, string> = {
  done: "border-status-ok bg-status-ok text-card",
  overdue: "border-status-late bg-status-late-soft text-status-late",
  due: "border-status-due bg-status-due-soft text-status-due",
  upcoming: "border-border bg-card",
};
const word: Record<VaccineStatus, string> = { done: "Given", overdue: "Overdue", due: "Due", upcoming: "Upcoming" };
const mark: Partial<Record<VaccineStatus, typeof Check>> = { done: Check, due: Clock, overdue: CircleAlert };

// Vertical timeline. The mark carries the status (check, clock, alert, empty ring)
// and the date is coloured to match; the words are for screen readers because the
// next step above already says what is due. The count lives in the summary ring.
export function VaccineTimeline({ vaccines: doses }: { vaccines: VaccineDose[] }) {
  const when = (v: VaccineDose) => (v.status === "done" ? v.givenOn : v.dueOn) ?? "";
  const vaccines = [...doses].sort((a, b) => when(a).localeCompare(when(b)));
  return (
    <SectionCard id="vaccines-title" icon={passportIcon.vaccines} title="Vaccines">
      {vaccines.length === 0 ? (
        <EmptyLine>No vaccines on file yet.</EmptyLine>
      ) : (
        <ol>
          {vaccines.map((v, i) => {
            const Mark = mark[v.status];
            return (
              <li key={v.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < vaccines.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />}
                <span aria-hidden className={cn("z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2", dot[v.status])}>
                  {Mark && <Mark className="size-3.5" strokeWidth={v.status === "done" ? 3 : 2.5} />}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-body font-medium">
                    {v.name} <span className="text-label font-normal text-muted-foreground">{v.dose}</span>
                  </p>
                  <p
                    className={cn(
                      "font-mono text-caption text-muted-foreground",
                      v.status === "due" && "text-status-due",
                      v.status === "overdue" && "text-status-late",
                    )}
                  >
                    <span className="sr-only">{word[v.status]}, </span>
                    {formatLongDate((v.status === "done" ? v.givenOn : v.dueOn) ?? "")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
