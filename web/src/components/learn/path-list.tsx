"use client";

import type { LearningPath } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { MiniBars } from "./dots";
import { PathMark } from "./path-cover";
import { minutesWord, nextLesson, progressOf, type Couple } from "./model";

/**
 * Every path for the family's stage, with both parents' progress as two thin
 * bars. A path nobody started invites instead of showing zeros. A row on
 * phones scrolls sideways so the open path stays near the top.
 */
export function PathList({ paths, couple, currentId, onPick }: { paths: LearningPath[]; couple: Couple; currentId: string; onPick: (p: LearningPath) => void }) {
  const { me, them } = couple;
  return (
    <nav aria-label="Learning paths" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] @4xl:mx-0 @4xl:overflow-visible @4xl:px-0">
      <ul className="flex gap-1.5 @4xl:flex-col">
        {paths.map((p, i) => {
          const mine = progressOf(p, me.id);
          const theirs = progressOf(p, them?.id);
          const anyone = mine.finished + mine.started + theirs.finished + theirs.started > 0;
          const first = nextLesson(p, me);
          const line = anyone
            ? `You ${mine.finished}${them ? `, ${them.displayName} ${theirs.finished}` : ""} of ${p.lessons.length}`
            : first
              ? `Start with ${minutesWord(first.minutes)}`
              : `${p.lessons.length} short reads`;
          const current = p.id === currentId;
          return (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(p)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "press grid w-full grid-cols-[2.75rem_1fr] items-center gap-3.5 rounded-[1.125rem] border px-3.5 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  current ? "border-line bg-card" : "border-transparent pointer-fine:hover:bg-muted",
                )}
              >
                <PathMark pathId={p.id} turn={i} />
                <span className="min-w-0">
                  <span className="block truncate text-title">{p.title}</span>
                  <span className="mt-1 flex items-center gap-2.5 text-caption whitespace-nowrap text-muted-foreground">
                    <MiniBars people={[{ person: me, progress: mine }, ...(them ? [{ person: them, progress: theirs }] : [])]} />
                    {line}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
