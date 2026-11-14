import { Check } from "lucide-react";
import type { VaccineDose, VaccineStatus } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { EmptyLine, SectionCard } from "./section-card";

const dot: Record<VaccineStatus, string> = {
  done: "border-status-ok bg-status-ok text-card",
  overdue: "border-status-late bg-status-late-soft",
  due: "border-status-due bg-status-due-soft",
  upcoming: "border-border bg-card",
};
const word: Record<VaccineStatus, string> = { done: "Given", overdue: "Overdue", due: "Due", upcoming: "Upcoming" };

// Vertical timeline: a filled dot with a check is done, a ringed dot is waiting.
// The bar on top counts how many doses are done.
export function VaccineTimeline({ vaccines }: { vaccines: VaccineDose[] }) {
  const done = vaccines.filter((v) => v.status === "done").length;
  return (
    <SectionCard
      id="vaccines-title"
      icon={passportIcon.vaccines}
      title="Vaccines"
      figure={
        vaccines.length > 0 && (
          <span className="text-right font-mono text-title tabular-nums">
            {done}
            <span className="text-label font-normal text-muted-foreground"> of {vaccines.length}</span>
          </span>
        )
      }
    >
      {vaccines.length === 0 ? (
        <EmptyLine>No vaccines on file yet.</EmptyLine>
      ) : (
        <>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${done} of ${vaccines.length} doses given`}>
            <div className="h-full rounded-full bg-status-ok" style={{ width: `${(done / vaccines.length) * 100}%` }} />
          </div>
          <ol>
            {vaccines.map((v, i) => (
              <li key={v.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < vaccines.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />}
                <span aria-hidden className={cn("z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2", dot[v.status])}>
                  {v.status === "done" && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-body font-medium">
                    {v.name} <span className="text-label font-normal text-muted-foreground">{v.dose}</span>
                  </p>
                  <p className="font-mono text-caption text-muted-foreground">
                    <span className={cn(v.status === "due" && "text-status-due", v.status === "overdue" && "text-status-late")}>{word[v.status]}</span>
                    {" · "}
                    {formatLongDate((v.status === "done" ? v.givenOn : v.dueOn) ?? "")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </SectionCard>
  );
}
