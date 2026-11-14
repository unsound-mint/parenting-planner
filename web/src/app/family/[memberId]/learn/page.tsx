import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Stage } from "@/lib/api/types";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { requireParent } from "@/lib/guard";
import { countWord } from "@/lib/format";
import { lessonAction, lessonsFor } from "@/lib/learn";
import { inLossSupport } from "@/lib/loss";
import { hasOlderChild, isPlanning } from "@/lib/stage";
import { WeeklyReadCard } from "@/components/learn/weekly-read";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { helpHref } from "@/components/shell/urgent-help-link";
import { LessonCard } from "@/components/learn/lesson-card";
import { LearnBoard } from "@/components/learn/learn-board";
import type { Talked } from "@/components/learn/lesson-list";
import { JourneyStrip } from "@/components/journey/journey-strip";
import { PracticeSection } from "@/components/simulator/practice-section";

// Learn: the one place to learn and prepare together. Learning paths with both
// parents' progress, lessons that open in place, a quiz to compare answers and
// a talk prompt; then hands-on practice (the simulator's scenarios) and short
// guides that end in one step. Journey and Practice keep their own routes for
// deep links; Learn presents them.
export default function LearnPage({ params, searchParams }: PageProps<"/family/[memberId]/learn">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Learn params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// Follows the content stage the API filtered the paths by (the child's age
// after a birth), not the stage stored at sign-up: a baby who turned one on the
// demo clock is in the toddler years, not "the first year".
const forWhen: Record<Stage, string> = {
  planning: "getting ready",
  trying: "getting ready",
  pregnancy: "the months before you meet",
  postpartum: "the first weeks at home",
  infant: "the first year",
  toddler: "the toddler years",
  preschool: "the preschool years",
  school_age: "the school years",
};

async function Learn({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { memberId } = await params;
  const query = await searchParams;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, paths, together, journey, simulator, guides, plan, tasks, questions, weekly] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/learning-paths", path),
    optional(api.GET("/members/{memberId}/together", path)),
    optional(api.GET("/members/{memberId}/journey", path)),
    api.GET("/members/{memberId}/simulator", path),
    api.GET("/members/{memberId}/guides", { params: { path: { memberId }, query: { kind: "article" } } }),
    api.GET("/members/{memberId}/plan", path),
    optional(api.GET("/members/{memberId}/tasks", path)),
    optional(api.GET("/members/{memberId}/appointment-questions", path)),
    optional(api.GET("/members/{memberId}/weekly-reads", path)),
  ]);
  if (family.response.status === 401) redirect("/");
  if (!family.data) notFound();
  // Pregnancy loss support has its own card on This week instead of stage lessons (the nav hides Learn too).
  if (inLossSupport(family.data)) notFound();

  const me = family.data.parents.find((p) => p.id === memberId);
  if (!me) notFound();
  const them = family.data.parents.find((p) => p.id !== memberId);
  const couple = { me, them };
  const items = paths.data?.items ?? [];

  const talked: Talked = {};
  for (const p of together?.prompts ?? []) if (p.talkedAt && p.talkedBy) talked[p.id] = { talkedAt: p.talkedAt, talkedBy: p.talkedBy };

  // The same gate as the nav (layout.tsx): newborn practice is baby prep, so
  // none in loss support (handled above), while planning, or past toddler age.
  const stage = { stage: paths.data?.stage ?? family.data.stage };
  const practice = simulator.data && !isPlanning(stage) && !hasOlderChild(stage) ? simulator.data : undefined;

  // A guide whose step is "practice this" points at the Practice section above it, so it is left out when that section shows.
  const steps = (guides.data ? lessonsFor(guides.data.items, plan.data?.items ?? []) : []).filter((g) => !(practice && lessonAction(g).kind === "practice"));
  const onlyFor = (audience: string[]) => (audience.length === 1 && audience[0] === "partner" ? "For partners" : audience.length === 1 && audience[0] === "mother" ? "For mothers" : undefined);
  const taskTitles = new Set((tasks?.items ?? []).map((t) => t.title));
  const asked = new Set((questions?.items ?? []).filter((q) => q.authorId === memberId).map((q) => q.text));
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  return (
    <PageFrame className="gap-8">
      <Rise as="header" i={0} className="flex flex-col gap-4 @7xl:flex-row @7xl:items-end @7xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-headline">Learn together</h1>
          <p className="mt-1.5 max-w-prose text-body text-ink-2">
            {items.length > 0 ? `${countWord(items.length)} ${items.length === 1 ? "path" : "paths"} for ${forWhen[stage.stage]}. ` : ""}
            {them ? "A few unhurried minutes a week, side by side." : "A few unhurried minutes a week."}
          </p>
        </div>
        {journey && <JourneyStrip journey={journey} memberId={memberId} className="@7xl:max-w-[50rem] @7xl:flex-nowrap" />}
      </Rise>

      {weekly && weekly.items.length > 0 && (
        <Rise i={1}>
          <WeeklyReadCard key={memberId} items={weekly.items} current={weekly.current} />
        </Rise>
      )}

      {items.length > 0 && (
        <LearnBoard
          key={memberId}
          memberId={memberId}
          couple={couple}
          initialPaths={items}
          initialPathId={one(query.path)}
          initialLessonId={one(query.lesson)}
          talked={talked}
          helpHref={helpHref(memberId)}
        />
      )}

      {practice && (
        <Rise i={4}>
          <PracticeSection progress={practice} memberId={memberId} />
        </Rise>
      )}

      {steps.length > 0 && (
        <Rise as="section" i={5} aria-labelledby="steps-title" className="flex flex-col gap-4">
          <div>
            <h2 id="steps-title" className="text-headline">
              Read it, then do one thing
            </h2>
            <p className="mt-1 text-label font-normal text-muted-foreground">Short guides for this week, each ending in a step for your plan or your next visit.</p>
          </div>
          <ul className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-3">
            {steps.map((g) => {
              const action = lessonAction(g);
              const done = action.kind === "task" ? taskTitles.has(action.title) : action.kind === "question" ? asked.has(action.text) : false;
              return <LessonCard key={g.id} memberId={memberId} guide={g} action={action} done={done} audience={onlyFor(g.audience)} />;
            })}
          </ul>
        </Rise>
      )}
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 @4xl:grid-cols-[17rem_minmax(0,1fr)] @7xl:grid-cols-[20rem_minmax(0,1fr)_24rem]">
        <div className="hidden h-96 animate-pulse rounded-3xl bg-muted @4xl:block" />
        <div className="h-[28rem] animate-pulse rounded-[2rem] bg-muted" />
        <div className="hidden h-80 animate-pulse rounded-3xl bg-muted @7xl:block" />
      </div>
    </main>
  );
}
