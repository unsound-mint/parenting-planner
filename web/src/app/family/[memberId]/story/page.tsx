import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { Rise } from "@/components/joy/rise";
import { Avatar } from "@/components/joy/partner-chip";
import { PageFrame } from "@/components/shell/page";
import { StoryBook } from "@/components/story/story-book";
import { PrintButton } from "@/components/story/print-button";

// Our story so far: the memory book the app has been writing from what the
// family already did. The API builds every page (api/internal/story); this
// screen only lays it out. Caregivers get their own edition from the same
// endpoint, without the parents' journal, visits, lessons or names.
export default function StoryPage({ params }: PageProps<"/family/[memberId]/story">) {
  return (
    <Suspense fallback={<Fallback />}>
      <OurStory params={params} />
    </Suspense>
  );
}

async function OurStory({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, story] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/story", path)]);
  if (family.response.status === 401 || story.response.status === 401) redirect("/");
  if (!family.data || !story.data) notFound();

  const people = familyPeople(family.data);
  const me = people.find((p) => p.id === memberId);
  if (!me) redirect("/family");
  const child = family.data.children.at(-1)?.name;
  const parents = people.filter((p) => !isCaregiver(p.role));
  const pages = story.data.chapters.reduce((n, c) => n + c.moments.length, 0);
  const chapters = story.data.chapters;

  return (
    <PageFrame className="gap-10 md:gap-14">
      <Rise as="header" i={0} className="flex flex-col gap-5 rounded-[1.75rem] bg-sun p-5.5 md:rounded-[2.25rem] md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">
              {isCaregiver(me.role) ? `${me.displayName}'s edition` : "Written as you go"}
            </p>
            <h1 className="text-display">
              Our story <em className="text-me">so far</em>
            </h1>
            <p className="max-w-prose text-body text-ink-2">
              {pages > 0
                ? `${pages} ${pages === 1 ? "page" : "pages"} in ${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}, written from what you did${isCaregiver(me.role) ? " with the family" : " together"}. Nothing to fill in: the book keeps writing itself.`
                : "Nothing to fill in: the book writes itself from what you do together. The first pages are just below."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex -space-x-2">
              {parents.map((p) => (
                <Avatar key={p.id} person={p} className="size-10 text-label ring-3 ring-sun" />
              ))}
            </span>
            <PrintButton />
          </div>
        </div>
        {chapters.length > 1 && (
          <nav aria-label="Chapters" className="flex flex-wrap gap-2 print:hidden">
            {chapters.map((c, i) => (
              <a
                key={c.kind}
                href={`#chapter-${i + 1}`}
                className={
                  "press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 " +
                  (c.current ? "bg-me text-white" : "bg-card/80 text-ink-2 hover:bg-card")
                }
              >
                <span className="font-mono text-caption opacity-70">{i + 1}</span>
                {c.title}
              </a>
            ))}
          </nav>
        )}
      </Rise>
      <StoryBook story={story.data} people={people} childName={child} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <PageFrame>
      <div className="h-56 animate-pulse rounded-[2.25rem] bg-sun/60 motion-reduce:animate-none" />
    </PageFrame>
  );
}
