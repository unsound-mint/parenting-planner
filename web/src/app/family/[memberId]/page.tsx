import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import type { AppointmentQuestionList, Family, MoodPattern, Parent, Plan, Task } from "@/lib/api/types";
import { familyNow } from "@/lib/clock";
import { dayKey, daysUntilInstant, formatClock, formatShortDate } from "@/lib/format";
import { inLossSupport } from "@/lib/loss";
import { LATE_PREGNANCY_WEEK } from "@/lib/schedule";
import { familyPeople } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { BabyHome } from "@/components/baby/baby-home";
import { BabyHomeSwitch } from "@/components/family/baby-home-switch";
import { LossSupport } from "@/components/loss/loss-support";
import { Rise } from "@/components/joy/rise";
import type { Mood } from "@/components/joy/mood-face";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { NamesQuestCard } from "@/components/names/names-quest-card";
import { NextPaperworkCard } from "@/components/paperwork/next-paperwork-card";
import { See3DLink } from "@/components/baby-3d/see-3d-link";
import { labLine } from "@/components/lab/lab-link";
import { ShareWeekButton } from "@/components/share/share-week-button";
import { pregnancyShareLine } from "@/lib/share";
import { optional } from "@/components/today/slots";
import type { CalmRow } from "@/components/week/calm-list";
import { CalmSlot } from "@/components/week/calm-slot";
import { LossHero, PregnancyHero, StageHero } from "@/components/week/hero";
import { QuickJournal } from "@/components/week/quick-journal";
import { ReadTogether } from "@/components/week/read-together";
import { bagByPerson, journalPrompt, journalStarters, pickMission, pickReads } from "@/components/week/this-week";
import { TogetherCard } from "@/components/week/together-card";
import { TwoOfYou } from "@/components/week/two-of-you";
import { WeekMission } from "@/components/week/week-mission";
import { WeekThanks } from "@/components/week/week-thanks";

// This week: one hero (the baby's size in pregnancy, what is happening now in
// other stages, with the 3D baby and "Share this week" under it), then two
// rows: reads and "Tonight, together"; the quick journal and the calm list of
// practical things. A third row holds what the two of you do this week: the
// names quest before the birth or the next paperwork step after it, with one
// suggested thank-you under it; one mission; and the "For the two of you" links (labor
// coach late in pregnancy, virtual baby, Compatibility Lab, money), grouped in
// one list rather than a card each. Everything is the family's live data.
//
// Each fact has one place: the hero owns the baby and the stage; the calm list
// owns plan items, the next visit (with its questions) and the hospital bag;
// mood is only the journal's faces. The plan page ("See all") has the rest.
// DOM order is the phone order (hero, journal, reads, together, calm list,
// then the third row); from a wide column the cells are placed by grid position.
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
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  if (!family) notFound();

  // Caregivers get the baby's care and never a parent's plan, mood, diary or
  // couple content, so decide who is acting before asking for any of them.
  const caregiver = family.caregivers?.find((c) => c.id === memberId);
  if (caregiver) {
    const week = family.stage === "pregnancy" ? family.gestationalWeek : undefined;
    // Weeks 4 to 40 only; a nanny never gets the card (the API answers 403).
    const card =
      week != null && week >= 4 && week <= 40 && caregiver.role !== "nanny"
        ? optional(api.GET("/members/{memberId}/pregnancy-weeks/{week}", { params: { path: { memberId, week } } }))
        : undefined;
    const today = optional(api.GET("/members/{memberId}/today", path));
    const guides = optional(api.GET("/members/{memberId}/guides", { params: { path: { memberId }, query: { kind: "article" } } }));
    return <BabyHome memberId={memberId} family={family} slots={{ today, guides, card }} />;
  }

  const parent = family.parents.find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (!parent) redirect("/family");
  const partner = family.parents.find((p) => p.id !== memberId);
  const now = familyNow(family);
  const loss = inLossSupport(family);
  const week = family.stage === "pregnancy" && !loss ? family.gestationalWeek : undefined;
  const pregnant = week != null;
  const late = pregnant && week >= LATE_PREGNANCY_WEEK;
  const sizeWeek = (w: number) => optional(api.GET("/members/{memberId}/pregnancy-weeks/{week}", { params: { path: { memberId, week: w } } }));

  const beforeBirth = ["pregnancy", "planning", "trying"].includes(family.stage);
  const [{ data: plan }, { data: checkins }, { data: patterns }, questions, card, start, end, stageNow, paths, together, bag, birthPlan, shifts, missions, thanks, lab] =
    await Promise.all([
      api.GET("/members/{memberId}/plan", path),
      api.GET("/members/{memberId}/mood-checkins", path),
      api.GET("/members/{memberId}/mood-patterns", path),
      optional(api.GET("/members/{memberId}/appointment-questions", path)),
      pregnant && week >= 4 && week <= 40 ? sizeWeek(week) : undefined,
      // The ends of the growth arc: "wk 4 · poppy seed" and "wk 40 · pumpkin".
      pregnant ? sizeWeek(4) : undefined,
      pregnant ? sizeWeek(40) : undefined,
      // Pregnancy answers 409 here (the size is its hero), and so does a family with no child after birth.
      !pregnant && !loss ? optional(api.GET("/members/{memberId}/now", path)) : undefined,
      !loss ? optional(api.GET("/members/{memberId}/learning-paths", path)) : undefined,
      !loss && partner ? optional(api.GET("/members/{memberId}/together", path)) : undefined,
      pregnant ? optional(api.GET("/members/{memberId}/tasks", { params: { path: { memberId }, query: { kind: "hospital_bag" } } })) : undefined,
      // The bag row links to "Going to the hospital" only when that screen has data, so it never opens a 404.
      pregnant ? optional(api.GET("/members/{memberId}/birth-plan", path)) : undefined,
      late ? optional(api.GET("/members/{memberId}/shifts", path)) : undefined,
      !loss ? optional(api.GET("/members/{memberId}/missions", path)) : undefined,
      !loss && partner ? optional(api.GET("/members/{memberId}/thanks/suggestions", path)) : undefined,
      // The lab compares two parents' answers, before the birth.
      !loss && partner && beforeBirth ? optional(api.GET("/members/{memberId}/lab", path)) : undefined,
    ]);
  if (!plan) notFound();

  const today = dayKey(now.toISOString());
  const todayMood = (checkins?.items ?? []).find((c) => c.authorId === memberId && dayKey(c.recordedAt) === today)?.mood as Mood | undefined;
  const rows = calmRows({
    family,
    memberId,
    partner,
    plan,
    questions,
    bag: bag?.items,
    bagHref: birthPlan ? `/family/${memberId}/hospital` : undefined,
    pattern: patterns?.items[0],
    now,
  });

  const journal = (
    <QuickJournal memberId={memberId} prompt={journalPrompt(family.stage, week)} starters={journalStarters(family.stage, partner?.displayName)} todayMood={todayMood} />
  );
  const calm =
    rows.length > 0 ? (
      <CalmSlot
        memberId={memberId}
        rows={rows}
        items={plan.items}
        tier={family.tier}
        footer={late && shifts ? <BabyHomeSwitch memberId={memberId} agreedShifts={shifts.items.filter((s) => s.status === "agreed")} /> : undefined}
      />
    ) : null;

  if (loss) {
    // Loss support: no baby, no reads, names or talk prompts. The support card,
    // a private journal line and the calm list stay.
    return (
      <PageFrame className="gap-6 @4xl:gap-7">
        <Rise i={0}>
          <LossHero name={parent.displayName} now={now} />
        </Rise>
        <div className="grid min-w-0 items-start gap-6 @4xl:gap-7 @5xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Rise i={1} className="min-w-0">
            <LossSupport memberId={memberId} />
          </Rise>
          {calm && (
            <Rise i={2} className="min-w-0 @5xl:row-span-2">
              {calm}
            </Rise>
          )}
          <Rise i={3} className="min-w-0">
            {journal}
          </Rise>
        </div>
      </PageFrame>
    );
  }

  const hasReads = !!paths && pickReads(paths.items, memberId).reads.length > 0;
  const togetherCard =
    partner && together && (together.nudge || together.prompts.length > 0) ? (
      <TogetherCard memberId={memberId} partner={partner} nudge={together.nudge} prompts={together.prompts} className="h-full" />
    ) : null;
  const second = hasReads || togetherCard ? "@5xl:row-start-2" : "@5xl:row-start-1";

  // Sharing needs the week card's picture: the size in pregnancy, the stage's "now" otherwise.
  const shareLine = pregnant ? (card?.size ? pregnancyShareLine(week, card.size.comparison) : undefined) : stageNow?.headline;
  const actions =
    pregnant || shareLine ? (
      <>
        {pregnant && <See3DLink memberId={memberId} week={week} />}
        {shareLine && <ShareWeekButton memberId={memberId} shareLine={shareLine} suggestedNickname={family.children[0]?.name} />}
      </>
    ) : undefined;

  const mission = missions && pickMission(missions.items) ? missions.items : undefined;
  const thank = thanks?.items[0];
  // Names are for before the birth (the quest answers 409 after it); paperwork is for the first weeks.
  const namesQuest = beforeBirth && !!partner;
  const paperwork = family.stage === "postpartum";
  const firstCell = namesQuest || paperwork || !!thank;
  const twoOfYou = (
    <TwoOfYou
      memberId={memberId}
      labor={late ? family : undefined}
      virtualBaby={pregnant}
      labLine={lab && partner ? labLine(lab.cards, partner.displayName) : undefined}
      money
      together={!!partner}
      after={(mission ? 1 : 0) + (firstCell ? 1 : 0)}
    />
  );

  return (
    <PageFrame className="gap-6 @4xl:gap-7">
      <Rise i={0}>
        {pregnant ? (
          <PregnancyHero family={family} week={week} card={card} ends={[start?.size?.comparison, end?.size?.comparison]} partnerName={partner?.displayName} now={now} actions={actions} />
        ) : (
          <StageHero family={family} now={now} stageNow={stageNow} actions={actions} />
        )}
      </Rise>

      <div className="grid min-w-0 gap-6 @4xl:gap-7 @5xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Rise i={3} className={cn("min-w-0 @5xl:col-start-1", second, !calm && "@5xl:col-span-2")}>
          {journal}
        </Rise>
        {hasReads && (
          <Rise i={1} className={cn("min-w-0 @5xl:col-start-1 @5xl:row-start-1", !togetherCard && "@5xl:col-span-2")}>
            <ReadTogether memberId={memberId} paths={paths.items} me={parent} partner={partner} now={now} closedNudgeIds={together?.closedNudgeIds} />
          </Rise>
        )}
        {togetherCard && (
          <Rise i={2} className={cn("min-w-0 @5xl:row-start-1", hasReads ? "@5xl:col-start-2" : "@5xl:col-span-2")}>
            {togetherCard}
          </Rise>
        )}
        {calm && (
          <Rise i={4} className={cn("min-w-0 @5xl:col-start-2", second)}>
            {calm}
          </Rise>
        )}
      </div>

      <PageGrid cols={3}>
        {firstCell && (
          <Rise i={5} className="min-w-0">
            <Stack>
              {namesQuest && (
                <Suspense fallback={null}>
                  <NamesQuestCard memberId={memberId} parents={family.parents} />
                </Suspense>
              )}
              {paperwork && (
                <Suspense fallback={null}>
                  <NextPaperworkCard memberId={memberId} />
                </Suspense>
              )}
              {thank && <WeekThanks memberId={memberId} suggestion={thank} people={familyPeople(family)} />}
            </Stack>
          </Rise>
        )}
        {mission && (
          <Rise i={6} className="min-w-0">
            <WeekMission memberId={memberId} items={mission} people={family.parents} className="h-full" />
          </Rise>
        )}
        {twoOfYou}
      </PageGrid>
    </PageFrame>
  );
}

const statusOrder = { overdue: 0, due: 1, upcoming: 2 } as const;
const visitDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });

function calmRows({
  family,
  memberId,
  partner,
  plan,
  questions,
  bag,
  bagHref,
  pattern,
  now,
}: {
  family: Family;
  memberId: string;
  partner?: Parent;
  plan: Plan;
  questions?: AppointmentQuestionList;
  bag?: Task[];
  bagHref?: string;
  pattern?: MoodPattern;
  now: Date;
}): CalmRow[] {
  const rows: CalmRow[] = [];

  const visit = questions?.appointments[0];
  if (visit) {
    const days = daysUntilInstant(visit.startsAt, now);
    const day = days === 0 ? "Today, " : days === 1 ? "Tomorrow, " : "";
    const date = `${day}${visitDate.format(new Date(visit.startsAt))}${visit.allDay ? "" : ` at ${formatClock(visit.startsAt)}`}`;
    const asks = questions.items.filter((q) => q.appointmentId === visit.id && !q.answered);
    rows.push({
      kind: "visit",
      id: `visit-${visit.id}`,
      title: visit.title,
      when: asks.length > 0 ? `${date} · ${asks.length} ${asks.length === 1 ? "question" : "questions"} ready` : date,
      note: partner && visit.attendeeIds.includes(partner.id) ? `${partner.displayName} is coming` : undefined,
      questions: asks.map((q) => ({ id: q.id, text: q.text })),
    });
  }

  // The rules plan, what needs doing first; past the first few, the rest open in place.
  // "See all" is the task plan (/plan), a different list.
  const items = [...plan.items].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const visible = visit ? 2 : 3;
  for (const [n, item] of items.entries()) {
    const due = item.dueBy ? formatShortDate(item.dueBy) : undefined;
    const when =
      item.status === "overdue"
        ? `Overdue${due ? `, was due ${due}` : ""}`
        : item.status === "due"
          ? due
            ? `Due by ${due}`
            : "Due now"
          : due
            ? `Coming up, by ${due}`
            : "Coming up";
    rows.push({
      kind: "plan",
      id: `plan-${item.ruleId}`,
      ruleId: item.ruleId,
      later: n >= visible,
      category: item.category,
      status: item.status,
      title: item.title,
      when,
      why: item.reason,
      source: item.source,
    });
  }

  if (bag) {
    const { done, total, byMember } = bagByPerson(bag);
    if (total > 0) {
      const people = family.parents.map((p) => ({ name: p.displayName, count: byMember.get(p.id) ?? 0, color: p.role === "mother" ? "bg-mom" : "bg-partner" }));
      const who = people
        .filter((p) => p.count > 0)
        .map((p) => `${p.name} ${p.count}`)
        .join(", ");
      rows.push({ kind: "bag", id: "bag", title: "Hospital bag", when: `${done} of ${total} packed${who ? ` · ${who}` : ""}`, done, total, parts: people, href: bagHref });
    }
  }

  if (pattern) {
    rows.push({
      kind: "talk",
      id: "talk",
      title: "Someone to talk to",
      when: `${pattern.days} heavy days in the last week`,
      why: pattern.message,
      href: `/family/${memberId}/directory?type=${pattern.providerType}`,
      source: pattern.source,
    });
  }
  return rows;
}

function WeekFallback() {
  return (
    <main className="flex flex-col gap-7 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-[29rem] animate-pulse rounded-[2.25rem] bg-sun/70" />
      <div className="grid gap-7 md:grid-cols-[1.55fr_1fr]">
        <div className="h-72 animate-pulse rounded-[1.75rem] bg-muted" />
        <div className="h-72 animate-pulse rounded-[1.75rem] bg-muted" />
      </div>
    </main>
  );
}
