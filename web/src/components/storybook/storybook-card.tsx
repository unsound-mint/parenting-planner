import { Suspense } from "react";
import Link from "next/link";
import { BookHeart, ChevronRight } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { StoryArt } from "./story-art";

/**
 * The way into the storybook from Baby (and the child's screen): the newest
 * book to read tonight, or an invitation to make the first one. Parents only;
 * the caller leaves it out for caregivers, who never see stories.
 */
export function StorybookCard({ memberId, childName }: { memberId: string; childName: string }) {
  return (
    <Suspense fallback={null}>
      <Card memberId={memberId} childName={childName} />
    </Suspense>
  );
}

async function Card({ memberId, childName }: { memberId: string; childName: string }) {
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/stories", { params: { path: { memberId } } });
  if (!data) return null;
  const latest = data.items[0];
  const base = `/family/${memberId}/baby/storybook`;
  return (
    <section aria-labelledby="storybook-title" className="flex overflow-hidden rounded-3xl border border-line bg-card">
      <Link href={latest ? `${base}/${latest.id}` : base} className="press w-32 shrink-0 md:w-40" aria-hidden tabIndex={-1}>
        <StoryArt art={latest?.pages[0]?.art ?? "moon"} ageMonths={latest?.ageMonths} seed="storybook-card" className="h-full" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 md:p-5">
        <p className="flex items-center gap-1.5 font-mono text-caption tracking-wide text-muted-foreground uppercase">
          <BookHeart aria-hidden className="size-3.5" /> Storybook
        </p>
        <h2 id="storybook-title" className="text-title text-balance">
          {latest ? (
            <Link href={`${base}/${latest.id}`} className="hover:underline">
              Read “{latest.title}” tonight
            </Link>
          ) : (
            <Link href={base} className="hover:underline">
              Make a picture book for {childName}
            </Link>
          )}
        </h2>
        <p className="text-label font-normal text-muted-foreground">Your own memories, told as a story to read aloud.</p>
        <Link href={base} className="press mt-auto flex min-h-11 w-fit items-center gap-1 text-label text-me">
          {data.items.length > 1 ? `All ${data.items.length} stories · make a new one` : "Make a new one"}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
