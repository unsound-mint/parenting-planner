import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Family } from "@/lib/api/types";
import { inLossSupport } from "@/lib/loss";
import { cn } from "@/lib/utils";

/** Who sees "Getting ready for birth": a pregnancy, not in loss support. The page applies the same gate. */
export function showsLaborCoach(family: Pick<Family, "stage" | "pregnancyLoss">): boolean {
  return family.stage === "pregnancy" && !inLossSupport(family);
}

/**
 * The way in to "Getting ready for birth" (/family/[memberId]/hospital) from
 * another screen. Pass the family: it renders nothing outside pregnancy or in
 * loss support, so it never links to a page that would 404. Parents only; do
 * not render it for a caregiver.
 */
export function LaborCoachLink({ memberId, family, className }: { memberId: string; family: Pick<Family, "stage" | "pregnancyLoss" | "gestationalWeek">; className?: string }) {
  if (!showsLaborCoach(family)) return null;
  const week = family.gestationalWeek;
  const line = week != null && week >= 37 ? "Contraction timer, when to call, breathing" : "Real or practice contractions, breathing, the timer";
  return (
    <Link
      href={`/family/${memberId}/hospital`}
      className={cn("press lift flex min-h-16 items-center gap-4 rounded-3xl border border-line bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <svg viewBox="0 0 48 48" className="size-11 shrink-0" aria-hidden>
        <circle cx="24" cy="24" r="22" className="fill-sun" />
        <path d="M24 9c8 0 15 4 17 11s1 15-4 19-12 6-18 4-11-5-13-11S9 16 14 13s6-4 10-4z" fill="#F7CB92" />
        <path d="M16 23c1.5 1.5 3.5 1.5 5 0M27 23c1.5 1.5 3.5 1.5 5 0" stroke="#2B2620" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M22 29c1.2 1.2 2.8 1.2 4 0" stroke="#2B2620" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-title">Getting ready for birth</span>
        <span className="block text-label font-normal text-muted-foreground">{line}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}
