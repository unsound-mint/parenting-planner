import { Suspense } from "react";
import type { Family, Guide, PregnancyWeek, Today } from "@/lib/api/types";
import { CaregiverToday } from "./caregiver-today";
import { ComingUp } from "./coming-up";
import { GuideList } from "./guide-list";
import { StageControl } from "./stage-control";
import { WeekCard } from "./week-card";

// Each piece of the home that depends on a newer endpoint is its own slot: the
// page starts the request, the slot waits for it and renders nothing when the
// endpoint has no data (501 until its backend lands, 403 for a role that may
// not see it). A failed or missing piece never changes the rest of the page.
export type Pending<T> = Promise<T | undefined> | undefined;

/** Resolves to the response data, or undefined on any error status or network failure. */
export function optional<T>(request: PromiseLike<{ data?: T }>): Promise<T | undefined> {
  return Promise.resolve(request).then(
    (r) => r.data,
    () => undefined,
  );
}

export function WeekCardSlot({ card }: { card: Pending<PregnancyWeek> }) {
  return (
    <Suspense fallback={null}>
      <WeekCardLoader card={card} />
    </Suspense>
  );
}
async function WeekCardLoader({ card }: { card: Pending<PregnancyWeek> }) {
  const data = await card;
  return data ? <WeekCard card={data} /> : null;
}

export function ComingUpSlot({ today }: { today: Pending<Today> }) {
  return (
    <Suspense fallback={null}>
      <ComingUpLoader today={today} />
    </Suspense>
  );
}
async function ComingUpLoader({ today }: { today: Pending<Today> }) {
  const data = await today;
  return data ? <ComingUp events={data.events} tasks={data.tasks} /> : null;
}

export function CaregiverTodaySlot({ today, names, shiftOnly }: { today: Pending<Today>; names: Record<string, string>; shiftOnly?: boolean }) {
  return (
    <Suspense fallback={null}>
      <CaregiverTodayLoader today={today} names={names} shiftOnly={shiftOnly} />
    </Suspense>
  );
}
async function CaregiverTodayLoader({ today, names, shiftOnly }: { today: Pending<Today>; names: Record<string, string>; shiftOnly?: boolean }) {
  const data = await today;
  return data ? <CaregiverToday today={data} names={names} shiftOnly={shiftOnly} /> : null;
}

export function GuidesSlot({ guides }: { guides: Pending<{ items: Guide[] }> }) {
  return (
    <Suspense fallback={null}>
      <GuidesLoader guides={guides} />
    </Suspense>
  );
}
async function GuidesLoader({ guides }: { guides: Pending<{ items: Guide[] }> }) {
  const data = await guides;
  // Two guides keep the home short; the API lists the most relevant first.
  return data ? <GuideList guides={data.items.slice(0, 2)} /> : null;
}

// The stage chip waits for the stage content endpoint (a preview mock counts): stage
// editing (updateFamily) and stage filtering (listGuides) are the same backend
// issue (#213), and a PATCH cannot be probed without changing data.
export function StageSlot({ guides, memberId, family }: { guides: Pending<{ items: Guide[] }>; memberId: string; family: Family }) {
  return (
    <Suspense fallback={null}>
      <StageLoader guides={guides} memberId={memberId} family={family} />
    </Suspense>
  );
}
async function StageLoader({ guides, memberId, family }: { guides: Pending<{ items: Guide[] }>; memberId: string; family: Family }) {
  if (!(await guides)) return null;
  return <StageControl memberId={memberId} stage={family.stage} dueDate={family.dueDate} hasChild={family.children.length > 0} />;
}
