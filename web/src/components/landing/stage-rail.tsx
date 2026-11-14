import { stageRail, railIndex } from "@/lib/demo-families";
import { stageValueIcon } from "@/lib/visuals";
import type { Stage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Where a family is on the journey: the current stage is filled, earlier ones
// are quieter, later ones are outlines. Same icons as the Journey screen.
export function StageRail({ stage, label }: { stage: Stage; label: string }) {
  const at = railIndex(stage);
  return (
    <ol aria-label={`Stage: ${label}`} className="flex items-center">
      {stageRail.map((s, i) => {
        const Icon = stageValueIcon[s.stage];
        return (
          <li key={s.stage} className="flex items-center" aria-current={i === at ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={cn("h-0.5 w-3 sm:w-4", i <= at ? "bg-primary/40" : "bg-border")} />}
            <span
              title={s.label}
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                i === at && "bg-primary text-primary-foreground",
                i < at && "bg-secondary text-secondary-foreground",
                i > at && "border border-border text-muted-foreground/60",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
