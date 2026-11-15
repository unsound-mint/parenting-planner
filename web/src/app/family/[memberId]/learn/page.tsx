import { Suspense } from "react";
import Link from "next/link";
import { MessageCircleQuestion, Pill } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { Stage } from "@/lib/api/types";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { requireParent } from "@/lib/guard";
import { countWord } from "@/lib/format";
import { inLossSupport } from "@/lib/loss";
import { hasOlderChild, isPlanning } from "@/lib/stage";
import { WeeklyReadCard } from "@/components/learn/weekly-read";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { helpHref } from "@/components/shell/urgent-help-link";
import { LearnBoard } from "@/components/learn/learn-board";
import { ForYouNow, LibraryEntry } from "@/components/learn/for-you-now";
import type { Talked } from "@/components/learn/lesson-list";
import { JourneyStrip } from "@/components/journey/journey-strip";
import { LabLink } from "@/components/lab/lab-link";
import { CapsuleLink } from "@/components/capsule/capsule-link";
import { StickerShelf } from "@/components/missions/sticker-shelf";
import { PracticeSection } from "@/components/simulator/practice-section";
import { VirtualBabyEntry } from "@/components/virtual-baby/entry-card";

// Learn: the one place to learn and prepare together. Learning paths with both
// parents' progress, lessons as cards that open into a reading sheet, a quiz to
// compare answers and a talk prompt; then hands-on practice (Virtual Baby and
// the simulator's scenarios). Guides that end in a plan step live on Plan.
// Journey and Practice keep their own routes for deep links; Learn presents them.
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
  const [family, paths, together, journey, simulator, weekly, stickers, library] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/learning-paths", path),
    optional(api.GET("/members/{memberId}/together", path)),
    optional(api.GET("/members/{memberId}/journey", path)),
    api.GET("/members/{memberId}/simulator", path),
    optional(api.GET("/members/{memberId}/weekly-reads", path)),
    optional(api.GET("/members/{memberId}/stickers", path)),
    optional(api.GET("/members/{memberId}/library-topics", path)),
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
          {stickers && <StickerShelf items={stickers.items} memberId={memberId} className="mt-3 w-fit" />}
          <Link href={`/family/${memberId}/learn/reference`} className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-line-2 bg-card px-4 text-label text-ink-2 transition-colors hover:border-ink-2">
            <Pill className="size-4" aria-hidden />
            Can I eat or take this?
          </Link>
          <Link
            href={`/family/${memberId}/learn/questions`}
            className="press mt-3 ml-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-me-soft px-4 text-label text-me transition-colors duration-(--duration-fast) hover:bg-me-soft/70"
          >
            <MessageCircleQuestion className="size-4" aria-hidden />
            Questions parents ask, and your own
          </Link>
        </div>
        {journey && <JourneyStrip journey={journey} memberId={memberId} className="@7xl:max-w-[50rem] @7xl:flex-nowrap" />}
      </Rise>

      {/* For you now: this week's read, the next lesson and one quiz deck, each once; the paths follow. */}
      <Rise as="section" i={1} aria-labelledby="now-title" className="flex min-w-0 flex-col gap-3">
        <h2 id="now-title" className="text-headline">
          For you now
        </h2>
        <div className="grid min-w-0 items-start gap-4 @7xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {weekly && weekly.items.length > 0 && (
            // Keyed on today's read so "Skip a week" (a refresh) lands on the new week.
            <WeeklyReadCard key={`${memberId}-${weekly.items[weekly.current]?.id}`} items={weekly.items} current={weekly.current} />
          )}
          <ForYouNow memberId={memberId} paths={items} me={me} />
        </div>
      </Rise>

      {them && (
        <Rise i={1} className="grid gap-4 @3xl:grid-cols-2">
          <Suspense fallback={null}>
            <LabLink memberId={memberId} partnerName={them.displayName} />
          </Suspense>
          {/* With a child, the time capsule is linked from Baby. */}
          {family.data.children.length === 0 && (
            <Suspense fallback={null}>
              <CapsuleLink memberId={memberId} />
            </Suspense>
          )}
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

      {library && (
        <Rise i={3}>
          <LibraryEntry memberId={memberId} ready={library.items.length + items.reduce((n, p) => n + p.lessons.length, 0)} soon={library.upcoming.length} />
        </Rise>
      )}

      {/* Virtual Baby (its own route) is for every parent, planning included, so it sits outside the practice gate.
          With practice it leads that section; alone it is one full-width card. */}
      {practice ? (
        <Rise i={3}>
          <PracticeSection progress={practice} memberId={memberId} lead={<VirtualBabyEntry memberId={memberId} />} />
        </Rise>
      ) : (
        <Rise i={3}>
          <VirtualBabyEntry memberId={memberId} />
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
