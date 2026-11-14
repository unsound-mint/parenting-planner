import type { Family } from "@/lib/api/types";
import { stageIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { journeyNodes, nodeIndex } from "./stages";

// The whole path from planning to age 9, kept small: context, not the point.
// The lanes above it carry what to do next.
export function PathStrip({ family }: { family: Family }) {
  const current = nodeIndex[family.stage];
  return (
    <nav aria-label="Stages from planning to age 9">
      <ol className="relative -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {journeyNodes.map((node, i) => {
          const Icon = stageIcon[node.key];
          const state = i < current ? "past" : i === current ? "current" : "future";
          return (
            <li key={node.key} aria-current={state === "current" ? "step" : undefined} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span aria-hidden className={cn("h-px w-3 md:w-5", i <= current ? "bg-primary" : "bg-border")} />}
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-1 text-caption",
                  state === "current" && "bg-primary font-semibold text-primary-foreground",
                  state === "past" && "text-muted-foreground",
                  state === "future" && "text-muted-foreground/80",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className={cn(state !== "current" && "sr-only md:not-sr-only")}>{node.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
