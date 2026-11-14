import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { SoftCard } from "@/components/joy/soft-card";
import type { LabCard } from "@/lib/api/types";
import { LabArt } from "./lab-art";

/** Who is waiting on whom, never a count of agreements. Shared with the link on This week. */
export function labLine(cards: LabCard[], partnerName: string): string {
  const waitingOnMe = cards.filter((c) => !c.mine && c.partnerAnswered).length;
  const turned = cards.filter((c) => c.reveal).length;
  return waitingOnMe > 0
    ? `${partnerName} answered ${waitingOnMe === 1 ? "a card" : `${waitingOnMe} cards`} and is waiting for you.`
    : turned > 0
      ? `${turned} ${turned === 1 ? "card has" : "cards have"} turned over. Pick one to talk about.`
      : "Short scenarios you each answer alone, then compare.";
}

/**
 * Learn's entry to the Parenting Compatibility Lab. It reads the cards itself
 * (render it inside <Suspense>) so Learn only has to place it. It shows who is
 * waiting, never a count of agreements.
 */
export async function LabLink({ memberId, partnerName }: { memberId: string; partnerName: string }) {
  const api = await serverApi();
  const lab = await optional(api.GET("/members/{memberId}/lab", { params: { path: { memberId } } }));
  if (!lab) return null;
  const line = labLine(lab.cards, partnerName);
  return (
    <Link href={`/family/${memberId}/learn/lab`} className="lift group block rounded-[1.75rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <SoftCard tone="them" className="flex items-center gap-5">
        <LabArt className="hidden w-28 shrink-0 @xl:block" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold tracking-[0.08em] text-them uppercase">For the two of you</p>
          <h2 className="mt-1 text-headline">Parenting Compatibility Lab</h2>
          <p className="mt-1 text-body text-ink-2">{line}</p>
        </div>
        <ArrowRight className="size-5 shrink-0 text-them" aria-hidden />
      </SoftCard>
    </Link>
  );
}
