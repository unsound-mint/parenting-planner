import type { AppointmentQuestion, Guide, PlanItem, Task } from "@/lib/api/types";
import { lessonAction, lessonsFor } from "@/lib/learn";
import { LessonCard } from "@/components/learn/lesson-card";

const onlyFor = (audience: string[]) => (audience.length === 1 && audience[0] === "partner" ? "For partners" : audience.length === 1 && audience[0] === "mother" ? "For mothers" : undefined);

/**
 * "Read it, then do one thing": short guides that each end in a step for the
 * plan or the next visit. They live under the shared plan because the step
 * lands there (a task, a visit question, a shift); Learn keeps the reading.
 */
export function PlanGuides({ memberId, guides, rulePlan, tasks, questions }: { memberId: string; guides: Guide[]; rulePlan: PlanItem[]; tasks: Task[]; questions: AppointmentQuestion[] }) {
  const steps = lessonsFor(guides, rulePlan);
  if (steps.length === 0) return null;
  const taskTitles = new Set(tasks.map((t) => t.title));
  const asked = new Set(questions.filter((q) => q.authorId === memberId).map((q) => q.text));
  return (
    <section aria-labelledby="steps-title" className="mt-4 flex flex-col gap-4 print:hidden">
      <div>
        <h2 id="steps-title" className="text-headline">
          Read it, then do one thing
        </h2>
        <p className="mt-1 text-label font-normal text-muted-foreground">Short guides for this week, each ending in a step for your plan or your next visit.</p>
      </div>
      <ul className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-3">
        {steps.map((g) => {
          const action = lessonAction(g);
          const done = action.kind === "task" ? taskTitles.has(action.title) : action.kind === "question" ? asked.has(action.text) : false;
          return <LessonCard key={g.id} memberId={memberId} guide={g} action={action} done={done} audience={onlyFor(g.audience)} />;
        })}
      </ul>
    </section>
  );
}
