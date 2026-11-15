import Link from "next/link";
import { Baby, ChevronRight, HeartHandshake, type LucideIcon } from "lucide-react";
import type { Family } from "@/lib/api/types";
import { Rise } from "@/components/joy/rise";
import { LaborCoachLink } from "@/components/labor/labor-coach-link";
import { cn } from "@/lib/utils";

/**
 * The small ways into bigger screens, grouped in one list instead of a card
 * each: the labor coach late in pregnancy, practice with the virtual baby, the
 * Compatibility Lab. The page decides which apply to the stage; each row looks
 * like LaborCoachLink, which is used as is. It sits in the narrow column, one row per link.
 */
export function TwoOfYou({
  memberId,
  labor,
  virtualBaby,
  labLine,
  together,
  className,
}: {
  memberId: string;
  /** The family, to add the labor coach row (it gates itself on pregnancy and loss). */
  labor?: Pick<Family, "stage" | "pregnancyLoss" | "gestationalWeek">;
  virtualBaby?: boolean;
  /** The lab's live line ("Sam answered a card and is waiting for you"); undefined hides the lab. */
  labLine?: string;
  /** Two parents: the heading says so. */
  together: boolean;
  className?: string;
}) {
  const base = `/family/${memberId}`;
  const links: { key: string; href: string; icon: LucideIcon; title: string; line: string }[] = [];
  if (virtualBaby) links.push({ key: "vb", href: `${base}/learn/virtual-baby`, icon: Baby, title: "Practice with a virtual baby", line: "One evening of feeds and cries, or the 48-hour challenge" });
  if (labLine) links.push({ key: "lab", href: `${base}/learn/lab`, icon: HeartHandshake, title: "Parenting Compatibility Lab", line: labLine });
  if (links.length === 0 && !labor) return null;
  return (
    <Rise as="section" i={7} aria-labelledby="two-of-you" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <h2 id="two-of-you" className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {together ? "For the two of you" : "For you"}
      </h2>
      <ul className="grid gap-3">
        {labor && (
          <li className="empty:hidden">
            <LaborCoachLink memberId={memberId} family={labor} className="h-full" />
          </li>
        )}
        {links.map(({ key, href, icon: Icon, title, line }) => (
          <li key={key}>
            <Link
              href={href}
              className="press lift flex h-full min-h-16 items-center gap-4 rounded-3xl border border-line bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-them-soft text-them">
                <Icon aria-hidden className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-title">{title}</span>
                <span className="block text-label font-normal text-muted-foreground">{line}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Rise>
  );
}
