import type { Family } from "@/lib/api/types";
import { stageIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { journeyNodes, journeyPosition } from "./stages";
import { YouAreHere } from "./you-are-here";

const ROW = "3.5rem"; // vertical row height on mobile; the marker position depends on it
const COUNT = journeyNodes.length;

// Horizontal on desktop, vertical on phones. The marker sits at a fractional
// node position computed from the family's stage and week or age.
// Geometry: node slot is 2.5rem (size-10) so the larger current circle fits;
// the track runs through the slot centres.
export function JourneyTimeline({ family }: { family: Family }) {
  const { index, position } = journeyPosition(family);
  return (
    <div
      className="relative rounded-2xl border border-border bg-card px-4 py-3 md:px-6 md:pt-16 md:pb-6"
      style={{ "--pos": position, "--count": COUNT, "--row": ROW } as React.CSSProperties}
    >
      {/* Track: grey for the whole path, sage up to the marker. */}
      <div aria-hidden className="absolute top-[calc(0.75rem+var(--row)/2)] left-[calc(1rem+1.25rem-1px)] h-[calc((var(--count)-1)*var(--row))] w-0.5 bg-border md:top-[calc(4rem+1.25rem-1px)] md:right-[calc(1.5rem+100%/16)] md:left-[calc(1.5rem+100%/16)] md:h-0.5 md:w-auto" />
      <div aria-hidden className="absolute top-[calc(0.75rem+var(--row)/2)] left-[calc(1rem+1.25rem-1px)] h-[calc(var(--pos)*var(--row))] w-0.5 bg-primary md:top-[calc(4rem+1.25rem-1px)] md:left-[calc(1.5rem+100%/16)] md:h-0.5 md:w-[calc(var(--pos)*(100%-3rem)/8)]" />

      <div
        aria-hidden
        className="absolute top-[calc(0.75rem+var(--pos)*var(--row)+var(--row)/2)] left-[calc(1rem+1.25rem)] -translate-x-1/2 -translate-y-1/2 md:top-[calc(4rem+1.25rem)] md:left-[calc(1.5rem+(100%-3rem)*(var(--pos)+0.5)/8)]"
      >
        <YouAreHere />
      </div>

      <ol className="relative grid md:grid-cols-8">
        {journeyNodes.map((node, i) => {
          const state = i < index ? "past" : i === index ? "current" : "future";
          const Icon = stageIcon[node.key];
          return (
            <li
              key={node.key}
              aria-current={state === "current" ? "step" : undefined}
              className="flex h-14 items-center gap-3 md:h-auto md:flex-col md:items-center md:gap-3 md:text-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    "flex items-center justify-center border-2 transition-colors",
                    node.milestone ? "rounded-xl" : "rounded-full",
                    state === "past" && "size-8 border-muted bg-muted text-muted-foreground",
                    state === "current" && "size-10 border-primary bg-primary text-primary-foreground",
                    state === "future" && "size-8 border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon className={state === "current" ? "size-5" : "size-4"} aria-hidden />
                </span>
              </span>
              <span className="min-w-0">
                <span className={cn("text-label block", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {node.label}
                  {state === "current" && (
                    <span className="text-caption ml-2 rounded-md bg-primary px-1.5 align-middle font-semibold text-primary-foreground md:sr-only">
                      You are here
                    </span>
                  )}
                </span>
                <span className="text-caption block text-muted-foreground">{node.hint}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
