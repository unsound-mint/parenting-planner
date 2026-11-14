"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import type { Guide } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Stage guides for this person, already filtered by the API (listGuides). Each
// opens in place with its steps and source.
export function GuideList({ guides }: { guides: Guide[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (guides.length === 0) return null;
  return (
    <section aria-labelledby="guides-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="guides-title" className="text-title">
        Worth a few minutes
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {guides.map((g) => {
          const open = openId === g.id;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.id)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-muted"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
                  <BookOpen className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">{g.title}</span>
                  <span className="block text-label text-muted-foreground">{g.summary}</span>
                  {g.minutes != null && <span className="block font-mono text-caption text-muted-foreground">{g.minutes} min</span>}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-220 ease-(--ease-out)", open && "rotate-180")} aria-hidden />
              </button>
              <div className={cn("grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
                <div className="min-h-0 overflow-hidden">
                  <ol className="list-decimal pt-1 pr-2 pb-1 pl-12 text-body">
                    {g.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="pb-2 pl-12 font-mono text-caption text-muted-foreground">
                    Demo content, not medical advice. {g.source.title}, checked {formatLongDate(g.source.checkedAt)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
