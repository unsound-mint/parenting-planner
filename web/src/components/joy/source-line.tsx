import type { Source } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** "NHS Start for Life: Week 25, week-by-week guide" reads as "NHS Start for Life"; the full title is the link's tooltip. */
export function shortSource(title: string): string {
  return title.split(/[:,(]| [-–] /)[0].trim();
}

const linkClass =
  "text-muted-foreground underline decoration-line-2 underline-offset-3 transition-colors duration-(--duration-fast) hover:text-ink hover:decoration-current";

/**
 * One source as a quiet inline link. For the admin content editor only: the
 * product UI shows sources on the dedicated sources page, never per card.
 */
export function SourceLink({ source, children = "Source", className }: { source: Pick<Source, "title" | "url">; children?: React.ReactNode; className?: string }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className={cn(linkClass, className)}>
      {children}
    </a>
  );
}
