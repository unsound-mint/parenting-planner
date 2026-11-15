import { CalendarCheck, Dumbbell, Route, Smile, Tag, TriangleAlert, Users, type LucideIcon } from "lucide-react";

// Only steps that work today. Keep in step with docs/demo-script.md; add a step
// when its screen lands, remove it if the screen goes away.
const steps: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: CalendarCheck, title: "Read This week", detail: "What is due now, and why it is in the plan." },
  { icon: Smile, title: "Log a mood check-in", detail: "Pick a face. Private unless you share it." },
  { icon: Users, title: "Switch to your partner", detail: "Same family, their own plan." },
  { icon: Dumbbell, title: "Practice a skill", detail: "Learn, then Practice: a round of newborn care." },
  { icon: Route, title: "Open Timeline", detail: "Your next weeks, with each step on a timeline." },
  { icon: Tag, title: "See the plans", detail: "Free, Plus and Concierge. Checkout runs in test mode." },
  { icon: TriangleAlert, title: "Try Urgent help", detail: "One screen with the numbers to call." },
];

export function HowToTry() {
  return (
    <section aria-labelledby="how-to-try" className="flex flex-col gap-4">
      <h2 id="how-to-try" className="text-title">
        How to try it
      </h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 lg:flex-col lg:gap-4 lg:p-4">
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <s.icon aria-hidden className="size-5" />
              <span className="absolute -right-1.5 -bottom-1.5 ring-2 ring-card flex size-5 items-center justify-center rounded-full bg-foreground text-caption font-medium text-background">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-body font-medium">{s.title}</p>
              <p className="text-label font-normal text-muted-foreground">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-label font-normal text-muted-foreground">
        To see both parents at once, use the window icon next to the name switch. It opens the other parent in a new
        window, in the same family.
      </p>
      <p className="text-label font-normal text-muted-foreground">
        Judging? The code, the scoring map and what is real versus preview data are in the{" "}
        <a
          href="https://github.com/unsound-mint/parenting-planner#for-the-jury"
          className="underline underline-offset-4 hover:text-foreground"
        >
          repository README
        </a>
        .
      </p>
    </section>
  );
}
