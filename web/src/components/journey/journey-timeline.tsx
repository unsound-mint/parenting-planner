import type { Family } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { journeyNodes, journeyPosition } from "./stages";
import { YouAreHere } from "./you-are-here";

const ROW = "3.5rem"; // vertical row height on mobile; the marker position depends on it
const COUNT = journeyNodes.length;

// Horizontal on desktop, vertical on phones. The marker sits at a fractional
// node position computed from the family's stage and week or age.
export function JourneyTimeline({ family }: { family: Family }) {
  const { index, position } = journeyPosition(family);
  return (
    <div
      className="relative rounded-2xl border border-border bg-card px-4 py-3 md:px-6 md:pt-10 md:pb-6"
      style={{ "--pos": position } as React.CSSProperties}
    >
      {/* Track: grey for the whole path, sage up to the marker. */}
      <div aria-hidden className="absolute top-[calc(1.75rem+0.75rem)] bottom-auto left-[calc(1rem+0.75rem-1px)] h-[calc((var(--count)-1)*var(--row))] w-0.5 bg-border md:top-[calc(2.5rem+0.4375rem-1px)] md:right-[calc(1.5rem+100%/16)] md:left-[calc(1.5rem+100%/16)] md:h-0.5 md:w-auto" style={{ "--count": COUNT, "--row": ROW } as React.CSSProperties} />
      <div aria-hidden className="absolute top-[calc(1.75rem+0.75rem)] left-[calc(1rem+0.75rem-1px)] h-[calc(var(--pos)*var(--row))] w-0.5 bg-primary md:top-[calc(2.5rem+0.4375rem-1px)] md:left-[calc(1.5rem+100%/16)] md:h-0.5 md:w-[calc(var(--pos)*(100%-3rem)/8)]" style={{ "--row": ROW } as React.CSSProperties} />

      <ol className="relative grid md:grid-cols-8">
        {journeyNodes.map((node, i) => {
          const state = i < index ? "past" : i === index ? "current" : "future";
          return (
            <li
              key={node.key}
              aria-current={state === "current" ? "step" : undefined}
              className="flex h-14 items-center gap-3 md:h-auto md:flex-col md:items-center md:gap-3 md:text-center"
            >
              <span className="flex size-6 shrink-0 items-center justify-center md:h-3.5">
                <span
                  className={cn(
                    "block size-3.5 border-2",
                    node.milestone ? "rotate-45 rounded-[3px]" : "rounded-full",
                    state === "past" && "border-muted-foreground/50 bg-muted-foreground/50",
                    state === "current" && "border-primary bg-primary",
                    state === "future" && "border-border bg-card",
                  )}
                />
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm leading-tight", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground", state === "future" && "font-medium")}>
                  {node.label}
                  {state === "current" && <span className="sr-only"> (you are here)</span>}
                </span>
                <span className="block text-xs leading-snug text-muted-foreground">{node.hint}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div
        aria-hidden
        className="absolute inset-x-4 top-[calc(0.75rem+var(--pos)*var(--row)+var(--row)/2)] -translate-y-1/2 md:inset-x-auto md:top-[calc(2.5rem+0.4375rem)] md:left-[calc(1.5rem+(100%-3rem)*(var(--pos)+0.5)/8)] md:w-6 md:-translate-x-1/2"
        style={{ "--row": ROW } as React.CSSProperties}
      >
        <YouAreHere />
      </div>
    </div>
  );
}
