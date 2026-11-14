import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { formatShortDate } from "@/lib/format";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { StoryReader } from "@/components/storybook/reader";

// One picture book: read it page by page, print it, and (for its author) share it.
export default function StoryPage({ params }: PageProps<"/family/[memberId]/baby/storybook/[storyId]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Reader params={params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: Promise<{ memberId: string; storyId: string }> }) {
  const { memberId, storyId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [{ data: family, response }, { data: story }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/stories/{storyId}", { params: { path: { memberId, storyId } } }),
  ]);
  if (response.status === 401) redirect("/");
  if (!family || !story) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const isAuthor = story.authorId === memberId;

  return (
    <PageFrame>
      <Rise i={0} as="header" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <Link href={`/family/${memberId}/baby/storybook`} className="press flex min-h-11 w-fit items-center gap-1 text-label text-muted-foreground">
          <ChevronLeft aria-hidden className="size-4" /> Storybook
        </Link>
        <p className="font-mono text-caption text-muted-foreground">
          {formatShortDate(story.createdAt)} · {story.generatedBy === "ai" ? "written with Claude from your memories" : "written from a story template"}
        </p>
      </Rise>
      <Rise i={1}>
        <StoryReader memberId={memberId} story={story} isAuthor={isAuthor} partnerName={partner?.displayName} />
      </Rise>
      <Rise i={2} as="section" aria-labelledby="memories-title" className="max-w-prose">
        <h2 id="memories-title" className="text-label text-muted-foreground">
          Made from {isAuthor ? "your" : `${story.signedAs}'s`} memories
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {story.memories.map((m) => (
            <li key={m} className="text-body text-ink-2">
              “{m}”
            </li>
          ))}
        </ul>
      </Rise>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="mt-8 aspect-[2/1] animate-pulse rounded-[2.25rem] bg-muted" />
    </main>
  );
}
