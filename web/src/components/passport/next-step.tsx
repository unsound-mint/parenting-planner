import { daysUntil } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import type { PassportPerson } from "@/lib/api/types";
import type { FollowUp } from "./summary";

function inDays(n: number): string {
  if (n === 0) return "today";
  const d = Math.abs(n);
  const span = d === 1 ? "1 day" : `${d} days`;
  return n > 0 ? `in ${span}` : `${span} ago`;
}

function describe(item: FollowUp, who: string): { title: string; line: string; late: boolean } {
  if (item.kind === "vaccine") {
    const late = item.vaccine.status === "overdue";
    return {
      title: `${item.vaccine.name}, ${item.vaccine.dose.toLowerCase()}`,
      line: `${late ? "Was due" : "Due"} ${inDays(daysUntil(item.vaccine.dueOn ?? ""))}. Book it at the next visit.`,
      late,
    };
  }
  if (item.kind === "lab") {
    return {
      title: `${item.lab.name} is ${item.lab.value > (item.lab.refHigh ?? Infinity) ? "above" : "below"} range`,
      line: `Bring it up at ${who} next visit.`,
      late: false,
    };
  }
  return {
    title: `${item.substance} is a suspected allergy`,
    line: `Ask about testing to confirm it at ${who} next visit.`,
    late: false,
  };
}

const icons = { vaccine: passportIcon.vaccines, lab: passportIcon.labs, allergy: passportIcon.allergies };

// Every open follow-up for the selected person, each with its one action. The
// only place that says "due"; the vaccine and lab cards below show the same
// items as marks, not words. The headline count is items.length.
export function NextStep({ person, items, onLogVaccine }: { person: PassportPerson; items: FollowUp[]; onLogVaccine?: (vaccineName: string) => void }) {
  const who = person.isActingParent ? "your" : `${person.name}'s`;
  if (items.length === 0) {
    return (
      <section aria-labelledby="next-step" className="flex items-center gap-4 rounded-2xl bg-status-ok-soft p-5 text-status-ok">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
          <passportIcon.vaccines className="size-5" aria-hidden />
        </span>
        <h2 id="next-step" className="text-title">Nothing to do right now.</h2>
      </section>
    );
  }
  const rows = items.map((item) => ({ item, ...describe(item, who) }));
  const anyLate = rows.some((r) => r.late);
  return (
    <section
      aria-labelledby="next-step"
      className={`rounded-2xl p-5 ${anyLate ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due"}`}
    >
      <h2 id="next-step" className="text-caption font-semibold tracking-wide uppercase">
        {rows.length === 1 ? "Next step" : `Next steps · ${rows.length}`}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((r, i) => {
          const Icon = icons[r.item.kind];
          return (
            <li key={i} className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-title">{r.title}</p>
                <p className="text-label font-normal">{r.line}</p>
              </div>
              {r.item.kind === "vaccine" && onLogVaccine && (
                <button
                  type="button"
                  onClick={() => onLogVaccine(r.item.kind === "vaccine" ? r.item.vaccine.name : "")}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-card px-4 text-label font-semibold outline-none transition-colors duration-150 hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Log as given
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
