import type { SimulatorSkill, SkillScore } from "@/lib/api/types";
import { skillIcon, skillLabel } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// One bar per skill. Below 70 percent is a weak spot: ochre bar and a written
// marker, so the state is never colour alone. A skill not played yet is empty.
export function SkillBars({ skills, highlight = [] }: { skills: SkillScore[]; highlight?: SimulatorSkill[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {skills.map((s) => {
        const Icon = skillIcon[s.skill];
        const score = s.score;
        return (
          <li key={s.skill} className={cn("flex items-center gap-3", highlight.includes(s.skill) && "font-medium")}>
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                s.weak ? "bg-status-due-soft text-status-due" : "bg-status-ok-soft text-status-ok",
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label">{skillLabel[s.skill]}</span>
                <span className="font-mono text-caption text-muted-foreground">
                  {score == null ? "Not played" : `${score}%`}
                  {s.weak && score != null && <span className="font-sans font-semibold text-status-due"> · Weak spot</span>}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${skillLabel[s.skill]} score`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score ?? undefined}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-320 ease-(--ease-out)", s.weak ? "bg-status-due" : "bg-status-ok")}
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
