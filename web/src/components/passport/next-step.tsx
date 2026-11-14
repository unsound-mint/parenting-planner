import { daysUntil } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import type { PassportPerson } from "@/lib/api/types";
import type { Focus } from "./summary";

function inDays(n: number): string {
  if (n === 0) return "today";
  const d = Math.abs(n);
  const span = d === 1 ? "1 day" : `${d} days`;
  return n > 0 ? `in ${span}` : `${span} ago`;
}

// The one focus of the screen, and the only place that says "due": what to do
// next for the selected person. The vaccine and lab cards below show the same
// item as a mark, not as words.
export function NextStep({ person, focus }: { person: PassportPerson; focus: Focus }) {
  const who = person.isActingParent ? "your" : `${person.name}'s`;
  if (focus.kind === "none") {
    return (
      <section aria-labelledby="next-step" className="flex items-center gap-4 rounded-2xl bg-status-ok-soft p-5 text-status-ok">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
          <passportIcon.vaccines className="size-5" aria-hidden />
        </span>
        <h2 id="next-step" className="text-title">Nothing to do right now.</h2>
      </section>
    );
  }
  const Icon = focus.kind === "vaccine" ? passportIcon.vaccines : focus.kind === "lab" ? passportIcon.labs : passportIcon.allergies;
  const text =
    focus.kind === "vaccine"
      ? {
          title: `${focus.vaccine.name}, ${focus.vaccine.dose.toLowerCase()}`,
          line: `${focus.vaccine.status === "overdue" ? "Was due" : "Due"} ${inDays(daysUntil(focus.vaccine.dueOn ?? ""))}. Book it at the next visit.`,
        }
      : focus.kind === "lab"
        ? {
            title: `${focus.lab.name} is ${focus.lab.value > (focus.lab.refHigh ?? Infinity) ? "above" : "below"} range`,
            line: `Bring it up at ${who} next visit.`,
          }
        : {
            title: `${focus.substance} is a suspected allergy`,
            line: `Ask about testing to confirm it at ${who} next visit.`,
          };
  const late = focus.kind === "vaccine" && focus.vaccine.status === "overdue";
  return (
    <section
      aria-labelledby="next-step"
      className={`flex items-center gap-4 rounded-2xl p-5 ${late ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due"}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold tracking-wide uppercase">Next step</p>
        <h2 id="next-step" className="text-title">{text.title}</h2>
        <p className="text-label font-normal">{text.line}</p>
      </div>
    </section>
  );
}
