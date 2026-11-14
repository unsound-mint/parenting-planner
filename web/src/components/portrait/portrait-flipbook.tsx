import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { FlipbookPlayer } from "./flipbook-player";
import { framesFor, seriesTitle, slotFor } from "./frames";

/**
 * The family's portrait series as a flipbook: the bump by week, then the
 * child month by month (or year by year from age two). Drag or tap through it;
 * it plays once when it comes into view. Parents get the upload card for this
 * month's slot. Owns its Suspense boundary, so a page embeds it in one line:
 *
 *   <PortraitFlipbook memberId={memberId} />
 *
 * childId narrows the series to one child (after the bump). Renders nothing
 * when there is nothing to photograph yet (planning) or the person may not see
 * portraits (a caregiver without baby_passport or pregnancy_updates).
 */
export function PortraitFlipbook({ memberId, childId, className }: { memberId: string; childId?: string; className?: string }) {
  return (
    <Suspense fallback={<FlipbookFallback className={className} />}>
      <Flipbook memberId={memberId} childId={childId} className={className} />
    </Suspense>
  );
}

async function Flipbook({ memberId, childId, className }: { memberId: string; childId?: string; className?: string }) {
  const api = await serverApi();
  const [{ data: family }, { data: list }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/portraits", { params: { path: { memberId } } }),
  ]);
  if (!family || !list) return null;
  const me = familyPeople(family).find((p) => p.id === memberId);
  if (!me) return null;
  const frames = framesFor(list.items, memberId, childId);
  const parent = !isCaregiver(me.role);
  const slot = parent ? slotFor(family, list.items, childId) : undefined;
  if (frames.length === 0 && !slot) return null;
  return <FlipbookPlayer memberId={memberId} title={seriesTitle(family, childId)} frames={frames} slot={slot} canEdit={parent} className={className} />;
}

function FlipbookFallback({ className }: { className?: string }) {
  return (
    <div className={className} aria-busy>
      <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 aspect-[4/5] w-full max-w-sm animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}
