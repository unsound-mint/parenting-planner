import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { countWord, familyContext } from "@/lib/format";
import { LATE_PREGNANCY_WEEK } from "@/lib/schedule";
import { AppointmentQuestions } from "@/components/week/appointment-questions";
import { HospitalEntry } from "@/components/hospital/hospital-entry";
import { PlanWithNote } from "@/components/week/plan-with-note";
import { MoodSleepCard } from "@/components/week/mood-sleep-card";
import { BabyHome } from "@/components/baby/baby-home";
import { BabyHomeSwitch } from "@/components/family/baby-home-switch";
import { PageFrame } from "@/components/shell/page";
import { GuidesSlot, StageSlot, WeekCardSlot, optional } from "@/components/today/slots";
import { familyNow } from "@/lib/clock";

// "This week": the acting parent's plan from the rules engine, the reason and
// source behind each item, and a quick mood check-in. All of it is live data.
//
// Each fact has one owner on this page, so nothing is printed twice:
// - headline: the status (how many things need you), never an item's title;
// - plan (focus card and rows): what to do, with the written note's line for
//   each item folded in and the why opening in place;
// - mood and sleep card: today's check-in, the last seven days and any pattern;
// - questions card: the next visits and what to ask there;
// - weekly card: the baby's week only (size, development, birth prep);
// - guides: only reading the plan does not already cover;
// - the top bar: the week of pregnancy and the due date.
// The DOM order is the phone order. From a wide content area the plan and the rest sit side by
// side; from the widest the rest splits in two, the questions card on its own column.
export default function WeekPage({ params }: PageProps<"/family/[memberId]">) {
  return (
    <Suspense fallback={<WeekFallback />}>
      <Week params={params} />
    </Suspense>
  );
}

async function Week({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  // Newer endpoints start now and render in their own slots; none of them gates the page.
  const guides = optional(api.GET("/members/{memberId}/guides", { params: { path: { memberId }, query: { kind: "article" } } }));
  // Caregivers get the baby's care and never a parent's plan or check-ins, so
  // decide who is acting before asking for any of them.
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  const caregiver = family?.caregivers?.find((c) => c.id === memberId);
  const week = family?.stage === "pregnancy" ? family.gestationalWeek : undefined;
  // Weeks 4 to 40 only; a nanny never gets the card (the API answers 403).
  const card =
    family && week != null && week >= 4 && week <= 40 && caregiver?.role !== "nanny"
      ? optional(api.GET("/members/{memberId}/pregnancy-weeks/{week}", { params: { path: { memberId, week } } }))
      : undefined;
  if (family && caregiver) {
    // Only the caregiver home uses Today; parents see their visits in the questions card and the calendar.
    const today = optional(api.GET("/members/{memberId}/today", path));
    return <BabyHome memberId={memberId} family={family} slots={{ today, guides, card }} />;
  }
  const [{ data: plan }, { data: checkins }, { data: patterns }, { data: shifts }] = await Promise.all([
    api.GET("/members/{memberId}/plan", path),
    api.GET("/members/{memberId}/mood-checkins", path),
    api.GET("/members/{memberId}/mood-patterns", path),
    // Answers 501 until the API lands; then the "Baby is home" switch stays hidden.
    api.GET("/members/{memberId}/shifts", path),
  ]);
  const parent = family?.parents.find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !parent) redirect("/family");
  if (!family || !parent || !plan) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const own = (checkins?.items ?? []).filter((c) => c.authorId === memberId);
  const pattern = patterns?.items[0];
  // With a pattern, the plan's mental health step carries "Talk to someone".
  const talkHref = pattern ? `/family/${memberId}/directory?type=${pattern.providerType}` : undefined;
  const talkInPlan = !!pattern && plan.items.some((i) => i.category === "mental_health");

  const needs = plan.items.filter((i) => i.status !== "upcoming").length;
  // Status only: the focus card right below names the first thing.
  const headline = family.pregnancyLoss
    ? `We are so sorry, ${parent.displayName}. Take the time you need.`
    : needs === 0
      ? `Nothing needs you this week, ${parent.displayName}.`
      : `${countWord(needs)} ${needs === 1 ? "thing needs" : "things need"} you this week, ${parent.displayName}.`;
  // The switch is a one-time step near the birth: last on the page, under everything that needs doing now.
  const late = family.stage === "pregnancy" && (family.gestationalWeek ?? 0) >= LATE_PREGNANCY_WEEK && shifts;

  return (
    <PageFrame className="grid content-start gap-8 @5xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @7xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section aria-labelledby="week-headline" className="min-w-0">
        <h1 id="week-headline" className="max-w-2xl text-headline text-balance">
          {headline}
        </h1>
        {/* The top bar shows this line from sm up; repeat it here only on phones, where the bar has no room. */}
        <p className="mt-2 text-label font-normal text-muted-foreground empty:hidden sm:hidden">{familyContext(family)}</p>
        <div className="mt-3 empty:hidden">
          <StageSlot guides={guides} memberId={memberId} family={family} />
        </div>
        <PlanWithNote items={plan.items} memberId={memberId} tier={family.tier} talkHref={talkHref} quietWhenEmpty={family.pregnancyLoss != null} />
      </section>

      {/* At the widest: two columns. The questions card is placed first in the right one and spans
          into the last, flexible row, so its height never opens gaps between the cards on the left. */}
      <aside aria-label="You and your visits" className="grid min-w-0 content-start items-start gap-6 @5xl:pt-1 @7xl:grid-cols-2 @7xl:grid-rows-[repeat(4,auto)_1fr]">
        <MoodSleepCard memberId={memberId} partnerName={partner?.displayName} checkins={own} pattern={pattern} talkInPlan={talkInPlan} now={familyNow(family)} />
        <div className="min-w-0 empty:hidden @7xl:col-start-2 @7xl:row-span-5 @7xl:row-start-1">
          <Suspense fallback={null}>
            <AppointmentQuestions memberId={memberId} partnerName={partner?.displayName} />
          </Suspense>
        </div>
        {family.stage === "pregnancy" && !family.pregnancyLoss && (family.gestationalWeek ?? 0) >= LATE_PREGNANCY_WEEK && (
          <Suspense fallback={null}>
            <HospitalEntry memberId={memberId} />
          </Suspense>
        )}
        <WeekCardSlot card={card} babyOnly />
        {/* In pregnancy loss support the support card replaces stage articles, even ones that would read as fine. */}
        {!family.pregnancyLoss && <GuidesSlot guides={guides} plan={plan.items} />}
        {late && <BabyHomeSwitch memberId={memberId} agreedShifts={shifts.items.filter((s) => s.status === "agreed")} />}
      </aside>
    </PageFrame>
  );
}

function WeekFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 h-40 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
