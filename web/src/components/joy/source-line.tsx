import type { Source } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** "NHS Start for Life: Week 25, week-by-week guide" reads as "NHS Start for Life"; the full title is the link's tooltip. */
export function shortSource(title: string): string {
  return title.split(/[:,(]| [-–] /)[0].trim();
}

const linkClass =
  "text-muted-foreground underline decoration-line-2 underline-offset-3 transition-colors duration-(--duration-fast) hover:text-ink hover:decoration-current";

/**
 * One source as a quiet inline link. Use it inside a sentence ("...per
 * <SourceLink source={s} />") or on its own as a small "Source" link. It opens
 * the page that was read and never shows a date: the checked date lives in the
 * rule data, not in the UI.
 */
export function SourceLink({ source, children = "Source", className }: { source: Pick<Source, "title" | "url">; children?: React.ReactNode; className?: string }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className={cn(linkClass, className)}>
      {children}
    </a>
  );
}

/**
 * Where a health fact comes from, as a small subtle link after the text:
 * "Source" for one, "Sources: NHS, WHO" for several. Not every card needs one;
 * leave it off crisis and urgent screens, logistics and anything that is not a
 * health or legal claim. Pass the API's Source objects straight through.
 */
export function SourceLine({ sources, className }: { sources: readonly Source[]; className?: string }) {
  if (sources.length === 0) return null;
  const one = sources.length === 1;
  return (
    <p className={cn("text-caption text-muted-foreground", className)}>
      {one ? (
        <SourceLink source={sources[0]} />
      ) : (
        <>
          Sources:{" "}
          {sources.map((s, n) => (
            <span key={s.url + n}>
              {n > 0 && ", "}
              <SourceLink source={s}>{shortSource(s.title)}</SourceLink>
            </span>
          ))}
        </>
      )}
    </p>
  );
}
