import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Journey, JourneyStage } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { stageIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";

const label: Record<JourneyStage, string> = {
  planning: "Planning",
  pregnancy: "Pregnancy",
  birth: "Birth",
  newborn: "Newborn",
  first_year: "First year",
  toddler: "Toddler",
  preschool: "Preschool",
  school_age: "School age",
};

// stageIcon is keyed by the journey node names with hyphens (components/journey/stages.ts).
const iconOf = (s: JourneyStage) => stageIcon[s.replace("_", "-")];

function where(j: Journey): string {
  const c = j.current;
  if (c.stage === "pregnancy" && c.gestationalWeek) return `Pregnancy, week ${c.gestationalWeek}`;
  if (c.childAgeMonths !== undefined && c.childAgeMonths >= 24) return `${label[c.stage]}, ${Math.floor(c.childAgeMonths / 12)} years old`;
  if (c.childAgeMonths !== undefined && c.childAgeMonths >= 3) return `${label[c.stage]}, ${c.childAgeMonths} months`;
  if (c.childAgeWeeks !== undefined) return `${label[c.stage]}, week ${c.childAgeWeeks + 1}`;
  return label[c.stage];
}

/**
 * "Your journey" as one small strip: the eight stages as dots, you are here,
 * and what comes next with its date. The long view stays small on purpose
 * (planning to age 9 is context, not a task); the weeks ahead live on /journey.
 */
export function JourneyStrip({ journey, memberId, className }: { journey: Journey; memberId: string; className?: string }) {
  const at = journey.stages.findIndex((s) => s.status === "current");
  const next = at >= 0 ? journey.stages[at + 1] : undefined;
  return (
    <section aria-label="Your journey" className={cn("flex flex-wrap items-center gap-x-5 gap-y-1 rounded-3xl border border-line bg-card px-4 py-3 md:px-5", className)}>
      <ol className="flex items-center" aria-hidden>
        {journey.stages.map((s, i) => {
          const Icon = iconOf(s.stage);
          const current = s.status === "current";
          return (
            <li key={s.stage} className="flex items-center">
              {i > 0 && <span className={cn("h-0.5 w-2.5 md:w-3.5", s.status === "future" ? "bg-line" : "bg-leaf/40")} />}
              <span
                title={label[s.stage]}
                className={cn(
                  "grid place-items-center rounded-full",
                  current ? "size-8 bg-me text-white" : s.status === "past" ? "size-5 bg-leaf-soft text-leaf" : "size-5 bg-muted text-muted-foreground",
                )}
              >
                {Icon && <Icon className={current ? "size-4" : "size-3"} strokeWidth={current ? 2 : 1.8} />}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="min-w-0 text-label font-normal text-muted-foreground">
        <span className="font-semibold text-ink">{where(journey)}</span>
        {next && (
          <>
            {" · next: "}
            {label[next.stage]}
            {next.startsOn && <span className="font-mono text-caption"> {formatShortDate(next.startsOn)}</span>}
          </>
        )}
      </p>
      <Link href={`/family/${memberId}/journey`} className="press inline-flex min-h-11 sm:ml-auto items-center gap-1.5 rounded-full px-2 text-label text-ink-2 underline decoration-line-2 underline-offset-3 hover:text-ink">
        The weeks ahead
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
