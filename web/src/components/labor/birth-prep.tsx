import Link from "next/link";
import { Baby, Car, Check, GraduationCap, MapPinned, NotebookPen, PhoneCall, type LucideIcon } from "lucide-react";
import type { BirthPlan, Task } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";

// Prepare for birth: a short list with timing. Each item reads its state from
// data that already exists (the shared plan's tasks, the birth plan) and says
// where to act; nothing is ticked here that the data does not say. The hospital
// bag is not repeated: it has its own card, and anything a bag list already
// holds (the car seat in the mock) stays there.

type Item = {
  id: string;
  icon: LucideIcon;
  title: string;
  /** When, in the family's weeks: the app's suggestion, not a guideline. Empty when a task date says it. */
  when: string;
  detail: string;
  state: { done: boolean; note: string; href?: string };
};

const findTask = (tasks: Task[], re: RegExp) => tasks.find((t) => t.kind === "task" && re.test(t.title));

function taskState(task: Task | undefined, memberId: string, missing: string): Item["state"] {
  const href = `/family/${memberId}/plan`;
  if (!task) return { done: false, note: missing, href };
  if (task.done) return { done: true, note: "Done", href };
  return { done: false, note: task.dueOn ? `In your plan, by ${formatShortDate(task.dueOn)}` : "In your plan", href };
}

export function BirthPrep({
  memberId,
  plan,
  tasks,
  birthParent,
}: {
  memberId: string;
  plan?: BirthPlan;
  tasks: Task[];
  birthParent: string;
}) {
  const classTask = findTask(tasks, /class/i);
  const bagHasCarSeat = tasks.some((t) => t.kind === "hospital_bag" && /car seat/i.test(t.title));
  const items: Item[] = [
    {
      id: "class",
      icon: GraduationCap,
      title: "Take a childbirth class together",
      // The task's own date wins over the suggested weeks, so the row never shows two timings.
      when: classTask?.dueOn ? "" : "wk 28–34",
      detail: "Breathing, positions and pain relief, learned before the day and practised as a pair.",
      state: taskState(classTask, memberId, "Add it to your plan"),
    },
    {
      id: "preferences",
      icon: NotebookPen,
      title: "Write your birth preferences",
      when: "by wk 36",
      detail: plan?.preferencesNote ?? "Pain relief you want to try first, who is in the room, skin to skin. Learn the options now, not mid-contraction.",
      state: plan?.preferencesNote ? { done: true, note: "Written. Bring a printed copy." } : { done: false, note: "Talk it through tonight" },
    },
    {
      id: "perineal",
      icon: Baby,
      title: "Perineal massage, if it feels right",
      when: "last 4 weeks",
      detail: `Done for at least the last four weeks of pregnancy, it meant less perineal trauma needing stitches, mostly fewer episiotomies, for a first vaginal birth. Tears were no different. ${birthParent}'s choice; ask the midwife or OB how.`,
      state: { done: false, note: "Optional" },
    },
    ...(bagHasCarSeat
      ? []
      : [
          {
            id: "car-seat",
            icon: Car,
            title: "Install the car seat, rear-facing",
            when: "by wk 36",
            detail: "In the back seat, never the front. Check the install against the seat's manual.",
            state: taskState(findTask(tasks, /car seat/i), memberId, "Add it to your plan"),
          } satisfies Item,
        ]),
    {
      id: "route",
      icon: MapPinned,
      title: "Know the route to the hospital",
      when: "by wk 36",
      detail: plan?.hospital ? "Drive it once, ideally at night, and know where to park and which door is open late." : "Choose where you will give birth, then drive the route once.",
      state: plan?.hospital ? { done: true, note: "In the hospital card", href: "#hospital" } : { done: false, note: "Not chosen yet" },
    },
    {
      id: "call",
      icon: PhoneCall,
      title: "Know who to call, and in what order",
      when: "by wk 37",
      detail: "The labor desk first, then your OB or midwife. Ask them now what their own rule for calling is, and set it in the timer.",
      state: plan?.contacts.length ? { done: true, note: `${plan.contacts.length} numbers in the call card`, href: "#hospital" } : { done: false, note: "Ask at your next visit" },
    },
  ];
  const done = items.filter((i) => i.state.done).length;

  return (
    <SoftCard as="section" aria-labelledby="prep-title" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">Prepare for birth</p>
          <h2 id="prep-title" className="mt-1 text-title">
            Before the day
          </h2>
        </div>
        <Dots done={done} total={items.length} />
      </div>
      <ol className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-2xl py-2.5">
            <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", item.state.done ? "bg-leaf text-primary-foreground" : "bg-muted text-ink-2")}>
              {item.state.done ? <Check className="size-4" strokeWidth={3} aria-label="Done" /> : <item.icon className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-label font-semibold">{item.title}</span>
                <span className="font-mono text-caption text-muted-foreground">{item.when}</span>
              </p>
              <p className="mt-0.5 text-label font-normal text-ink-2">{item.detail}</p>
              <p className="mt-1 text-caption">
                {item.state.href ? (
                  <Link href={item.state.href} className={cn("inline-flex min-h-11 items-center underline-offset-3 hover:underline md:min-h-0", item.state.done ? "text-leaf" : "text-primary")}>
                    {item.state.note}
                  </Link>
                ) : (
                  <span className={item.state.done ? "text-leaf" : "text-muted-foreground"}>{item.state.note}</span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SoftCard>
  );
}

function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-1 pt-1" role="img" aria-label={`${done} of ${total} ready`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("size-2.5 rounded-full", i < done ? "bg-leaf" : "bg-line-2")} />
      ))}
    </span>
  );
}
