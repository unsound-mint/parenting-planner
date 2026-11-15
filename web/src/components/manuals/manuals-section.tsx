import Link from "next/link";
import { Check, Clock } from "lucide-react";
import type { Manual } from "@/lib/api/types";
import { ManualScene } from "./scenes";

/**
 * Hands-on manuals on the Practice tab: one card per manual with its finished
 * picture. Opening a card plays it step by step (simulator/manuals/[id]).
 * Sources stay on the footer sources page, never on the card.
 */
export function ManualsSection({ manuals, memberId }: { manuals: Manual[]; memberId: string }) {
  if (manuals.length === 0) return null;
  const next = manuals.find((m) => !m.completedAt);
  return (
    <section aria-labelledby="manuals-title" className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 id="manuals-title" className="text-headline">
          Learn it with your hands
        </h2>
        <p className="mt-1 text-label font-normal text-muted-foreground">
          {next ? `Start with ${next.title.toLowerCase()}. Grab a blanket or a doll and follow along.` : "All practised. Run through one again before the big day."}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 @5xl:grid-cols-3">
        {manuals.map((m) => (
          <li key={m.id}>
            <Link
              href={`/family/${memberId}/simulator/manuals/${m.id}`}
              className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="aspect-[4/3] bg-paper p-3">
                <ManualScene scene={m.steps[m.steps.length - 1].scene} className="size-full" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <h3 className="text-title">{m.title}</h3>
                <p className="text-label font-normal text-muted-foreground">{m.summary}</p>
                <p className="mt-auto flex items-center gap-3 pt-2 text-caption text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="size-3.5" aria-hidden />
                    {m.minutes} min · {m.steps.length} steps
                  </span>
                  {m.completedAt && (
                    <span className="inline-flex items-center gap-1 text-ink">
                      <Check className="size-3.5 text-leaf" aria-hidden />
                      Practised
                    </span>
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
