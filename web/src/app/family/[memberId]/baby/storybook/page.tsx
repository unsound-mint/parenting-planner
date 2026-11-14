import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { StoryComposer } from "@/components/storybook/composer";
import { StoryShelf } from "@/components/storybook/shelf";

// The family storybook: make a picture book from memories the parent picks,
// and the shelf of books this parent may read (their own and shared ones).
export default function StorybookPage({ params }: PageProps<"/family/[memberId]/baby/storybook">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Storybook params={params} />
    </Suspense>
  );
}

function monthsSince(birth: string, now: Date) {
  const b = new Date(birth);
  let m = (now.getUTCFullYear() - b.getUTCFullYear()) * 12 + now.getUTCMonth() - b.getUTCMonth();
  if (now.getUTCDate() < b.getUTCDate()) m--;
  return Math.max(m, 0);
}

async function Storybook({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family, response }, stories, diary] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/stories", path),
    api.GET("/members/{memberId}/diary-entries", path),
  ]);
  if (response.status === 401) redirect("/");
  if (!family || !stories.data) notFound();
  const me = family.parents.find((p) => p.id === memberId);
  if (!me) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);
  const now = new Date();
  const ages = Object.fromEntries(family.children.map((c) => [c.id, monthsSince(c.birthDate, now)]));
  // Only the parent's own lines: a story is theirs, so it is made from what they wrote.
  const journal = (diary.data?.items ?? []).filter((e) => e.authorId === memberId).map((e) => ({ id: e.id, text: e.body }));
  const names = new Map(family.parents.map((p) => [p.id, p.displayName]));
  const items = stories.data.items;
  const child = family.children[0];

  return (
    <PageFrame>
      <Rise i={0} as="header" className="flex flex-col gap-2">
        <Link href={`/family/${memberId}/baby`} className="press flex min-h-11 w-fit items-center gap-1 text-label text-muted-foreground">
          <ChevronLeft aria-hidden className="size-4" /> Baby
        </Link>
        <h1 className="text-headline text-balance">{child ? `A picture book for ${child.name.split(" ")[0]}` : "A picture book for your little one"}</h1>
      </Rise>
      <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Rise i={1}>
          <SoftCard tone="sun" hero>
            <StoryComposer
              memberId={memberId}
              kids={family.children.map((c) => ({ id: c.id, name: c.name }))}
              ageMonths={ages}
              signedAs={me.role === "mother" ? "Mommy" : "Daddy"}
              partnerName={partner?.displayName}
              aiEnabled={stories.data.aiEnabled}
              journal={journal}
            />
          </SoftCard>
        </Rise>
        {items.length > 0 && (
          <Rise i={2} as="section" aria-labelledby="shelf-title" className="flex flex-col gap-3">
            <h2 id="shelf-title" className="text-title">
              On the shelf
            </h2>
            <StoryShelf memberId={memberId} stories={items} names={names} />
          </Rise>
        )}
      </div>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-96 animate-pulse rounded-[2.25rem] bg-muted" />
    </main>
  );
}
