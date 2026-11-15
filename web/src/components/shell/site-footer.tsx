import Link from "next/link";
import { cn } from "@/lib/utils";

const linkClass = "underline decoration-line-2 underline-offset-3 transition-colors duration-150 hover:text-foreground hover:decoration-current";

/**
 * The quiet line at the end of every page: how we check guidance, privacy and
 * the "not medical advice" note. Cards never cite sources themselves; the
 * sources page this links to is where they all live (docs/design.md, rule 3).
 * Privacy is per person, so it shows only inside a family (memberId set).
 */
export function SiteFooter({ memberId, className }: { memberId?: string; className?: string }) {
  return (
    <footer className={cn("print:hidden flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-line pt-4 text-caption text-muted-foreground", className)}>
      <Link href="/sources" className={linkClass}>
        How we check health guidance
      </Link>
      {memberId && (
        <Link href={`/family/${memberId}/privacy`} className={linkClass}>
          Privacy
        </Link>
      )}
      <span>General guidance, not medical advice. Your own doctor or midwife knows you best.</span>
    </footer>
  );
}
