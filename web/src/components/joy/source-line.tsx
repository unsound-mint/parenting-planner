import type { Source } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** "NHS Start for Life: Week 25, week-by-week guide" reads as "NHS Start for Life" in the line; the full title is the link's tooltip. */
export function shortSource(title: string): string {
  return title.split(/[:,(]| [-–] /)[0].trim();
}

/**
 * Where a health fact comes from, in one quiet mono line:
 * "NHS Start for Life · WHO · checked 2026-11-14". Each name links to the page
 * that was opened; the date is the most recent checkedAt. Pass the API's
 * Source objects straight through. Every health claim on a screen carries one
 * (docs/design.md, rule 3).
 */
export function SourceLine({ sources, className }: { sources: readonly Source[]; className?: string }) {
  if (sources.length === 0) return null;
  const checked = sources.map((s) => s.checkedAt).sort().at(-1);
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-caption text-muted-foreground", className)}>
      {sources.map((s, n) => (
        <span key={s.url + n} className="inline-flex items-baseline gap-1.5">
          {n > 0 && <span aria-hidden>·</span>}
          <a
            href={s.url}
            target="_blank"
            rel="noopener"
            title={s.title}
            className="underline decoration-line-2 underline-offset-3 transition-colors duration-(--duration-fast) hover:text-ink hover:decoration-current"
          >
            {shortSource(s.title)}
          </a>
        </span>
      ))}
      <span aria-hidden>·</span>
      <span>checked {checked}</span>
    </p>
  );
}
