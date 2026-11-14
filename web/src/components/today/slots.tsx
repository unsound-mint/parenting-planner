import { Suspense } from "react";
import type { Family, Guide, PlanItem, PregnancyWeek, Today } from "@/lib/api/types";
import { guideRepeatsPlan, weekCardBeyondPlan } from "@/lib/week";
import { CaregiverToday } from "./caregiver-today";
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

// plan: on a parent's This week, the card keeps only the baby's week (no to-dos) and
// drops the week number the top bar shows (lib/week.ts); it renders nothing when no
// new fact is left.
export function WeekCardSlot({ card, plan }: { card: Pending<PregnancyWeek>; plan?: PlanItem[] }) {
  return (
    <Suspense fallback={null}>
      <WeekCardLoader card={card} plan={plan} />
    </Suspense>
  );
}
async function WeekCardLoader({ card, plan }: { card: Pending<PregnancyWeek>; plan?: PlanItem[] }) {
  const data = await card;
  if (!data) return null;
  if (!plan) return <WeekCard card={data} />;
  const left = weekCardBeyondPlan(data, plan);
  return left ? <WeekCard card={left} withWeek={false} /> : null;
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

// plan: leave out guides about a plan item; the item already says it.
export function GuidesSlot({ guides, plan }: { guides: Pending<{ items: Guide[] }>; plan?: PlanItem[] }) {
  return (
    <Suspense fallback={null}>
      <GuidesLoader guides={guides} plan={plan} />
    </Suspense>
  );
}
async function GuidesLoader({ guides, plan }: { guides: Pending<{ items: Guide[] }>; plan?: PlanItem[] }) {
  const data = await guides;
  if (!data) return null;
  const items = plan ? data.items.filter((g) => !guideRepeatsPlan(g, plan)) : data.items;
  // Two guides keep the home short; the API lists the most relevant first.
  return <GuideList guides={items.slice(0, 2)} />;
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
