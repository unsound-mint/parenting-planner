import type { ParentView } from "@/server/queries";

const fmtMinute = (m: number | null) =>
  m == null ? "" : `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Placeholder "Today" screen for one parent. Frontend owns the real design.
export function ParentPanel({ view }: { view: ParentView }) {
  const { me, partner, family, myTasks, familyPlan, lastFeeding, incomingHandoff } = view;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <header>
        <p className="text-sm uppercase tracking-wide text-zinc-500">{me.role === "mom" ? "Mom" : "Partner"}</p>
        <h2 className="text-2xl font-semibold">{me.name}&apos;s today</h2>
      </header>

      {incomingHandoff && (
        <p className="rounded-lg bg-amber-100 p-3 text-amber-900">{partner.name} is handing the baby to you.</p>
      )}

      {family.stage === "baby_home" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Last feeding: {lastFeeding ? lastFeeding.at.toLocaleTimeString() : "none logged yet"}
        </p>
      )}

      <div>
        <h3 className="font-medium">My tasks</h3>
        <ul className="mt-1 list-disc pl-5">
          {myTasks.map((t) => (
            <li key={t.id}>
              {t.title} {t.kind === "shift" && `(${fmtMinute(t.startMinute)} to ${fmtMinute(t.endMinute)})`}
            </li>
          ))}
          {myTasks.length === 0 && <li className="list-none text-zinc-500">Nothing for now</li>}
        </ul>
      </div>

      <div>
        <h3 className="font-medium">Family plan</h3>
        <p className="text-sm text-zinc-500">{familyPlan.length} items in this stage</p>
      </div>
    </section>
  );
}
