import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Mission } from "@/lib/api/types";
import { StickerArt } from "@/components/illustrations";

/** People's entry to Missions: the next open mission as the teaser, so the link already says what to do. */
export function MissionsLink({ memberId, missions }: { memberId: string; missions: readonly Mission[] }) {
  const next = missions.find((m) => m.state === "taken") ?? missions.find((m) => m.state === "open");
  return (
    <Link href={`/family/${memberId}/people/missions`} className="group flex min-h-16 items-center gap-3.5 rounded-3xl border border-line bg-card p-3.5 press lift">
      <StickerArt art={`mission_${next?.category ?? "together"}`} className="size-12 shrink-0 -rotate-3 drop-shadow-[0_2px_3px_rgb(43_38_32/0.18)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-title">Missions for the two of you</span>
        <span className="block truncate text-label font-normal text-muted-foreground">{next ? `${next.state === "taken" ? "On the go" : "Try"}: ${next.title}` : "Small jobs that make the weeks ahead easier"}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" />
    </Link>
  );
}
