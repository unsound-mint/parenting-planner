import type { Parent } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import type { Progress } from "./model";

/**
 * One parent's progress in a path, drawn: a dot per lesson, finished ones
 * filled in their own colour, a started one half filled. Fills grow in with a
 * transform transition (and from zero on first paint via @starting-style), so a
 * lesson marked read fills its dot in place and a quick undo retargets.
 */
export function ProgressDots({ person, progress, size = "md", className }: { person: Parent; progress: Progress; size?: "sm" | "md"; className?: string }) {
  const fill = roleAccent[person.role].bg;
  return (
    <span className={cn("flex items-center", size === "md" ? "gap-1.25" : "gap-1", className)} aria-hidden>
      {Array.from({ length: progress.total }, (_, i) => {
        const amount = i < progress.finished ? 1 : i < progress.finished + progress.started ? 0.5 : 0;
        return (
          <span key={i} className={cn("relative overflow-hidden rounded-full bg-line", size === "md" ? "size-2.5" : "size-2")}>
            <span
              className={cn(
                "absolute inset-0 origin-left rounded-full transition-[scale] duration-(--duration-slow) ease-(--ease-out) [scale:var(--fill)_1] starting:[scale:0_1]",
                fill,
              )}
              style={{ "--fill": amount, transitionDelay: `${i * 40}ms` } as React.CSSProperties}
            />
          </span>
        );
      })}
    </span>
  );
}

/** "Emily, 3 of 8" with her avatar and dots. Says "you" for the acting parent in the label only. */
export function ParentProgress({ person, progress, isMe }: { person: Parent; progress: Progress; isMe: boolean }) {
  const label = `${isMe ? "You" : person.displayName}, ${progress.finished} of ${progress.total}`;
  return (
    <span className="flex items-center gap-2.5 text-label font-normal text-ink-2">
      <Avatar person={person} size="sm" />
      <ProgressDots person={person} progress={progress} />
      <span aria-label={`${label} read`}>{label}</span>
    </span>
  );
}

/** Two thin bars for the path list, one per parent. */
export function MiniBars({ people }: { people: { person: Parent; progress: Progress }[] }) {
  return (
    <span className="flex w-18 shrink-0 flex-col gap-0.75" aria-hidden>
      {people.map(({ person, progress }) => (
        <span key={person.id} className="relative block h-1 overflow-hidden rounded-full bg-line">
          <span
            className={cn("absolute inset-0 origin-left rounded-full transition-[scale] duration-(--duration-slow) ease-(--ease-out) [scale:var(--fill)_1] starting:[scale:0_1]", roleAccent[person.role].bg)}
            style={{ "--fill": progress.total ? progress.finished / progress.total : 0 } as React.CSSProperties}
          />
        </span>
      ))}
    </span>
  );
}
