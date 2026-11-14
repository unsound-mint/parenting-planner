import { formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import type { PassportPerson } from "@/lib/api/types";
import type { Focus } from "./summary";
import { RangeBar } from "./range-bar";

// The one focus of the screen: what to do next for the selected person.
export function NextStep({ person, focus }: { person: PassportPerson; focus: Focus }) {
  if (focus.kind === "none") return null;
  const who = person.isActingParent ? "your" : `${person.name}'s`;
  const Icon = focus.kind === "vaccine" ? passportIcon.vaccines : focus.kind === "lab" ? passportIcon.labs : passportIcon.allergies;
  const text =
    focus.kind === "vaccine"
      ? { title: `${focus.vaccine.name}, ${focus.vaccine.dose.toLowerCase()}`, line: `${focus.vaccine.status === "overdue" ? "Was due" : "Due"} ${formatLongDate(focus.vaccine.dueOn ?? "")}. Book it at the next visit.` }
      : focus.kind === "lab"
        ? { title: `${focus.lab.name} is ${focus.lab.value > (focus.lab.refHigh ?? Infinity) ? "above" : "below"} range`, line: `Worth bringing up at ${who} next visit.` }
        : { title: `${focus.substance} is a suspected allergy`, line: `Ask about testing to confirm it at ${who} next visit.` };
  return (
    <section aria-labelledby="next-step" className="flex items-center gap-4 rounded-2xl bg-status-due-soft p-5 text-status-due">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="next-step" className="text-title">{text.title}</h2>
        <p className="text-label font-normal">{text.line}</p>
        {focus.kind === "lab" && <div className="mt-2 max-w-xs"><RangeBar lab={focus.lab} /></div>}
      </div>
    </section>
  );
}
