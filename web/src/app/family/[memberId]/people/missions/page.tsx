import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { MissionBoard } from "@/components/missions/mission-board";
import { StickerShelf } from "@/components/missions/sticker-shelf";
import type { Mission } from "@/lib/api/types";

// Missions: small, concrete jobs for either parent, mostly the one who is not
// pregnant. They live in People next to the load map ("who carries what").
// Taking a mission puts a task in the shared plan; finishing it can earn a sticker.
export default function MissionsPage({ params }: PageProps<"/family/[memberId]/people/missions">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Missions params={params} />
    </Suspense>
  );
}

const stageWords: Record<string, string> = {
  planning: "while you plan",
  first_trimester: "in the first trimester",
  second_trimester: "in the second trimester",
  third_trimester: "before the baby comes",
  newborn: "in the first weeks",
  baby: "in the first year",
  toddler: "at this age",
};

async function Missions({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, list, stickers] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/missions", path), api.GET("/members/{memberId}/stickers", path)]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !list.data) notFound();

  const people = family.data.parents;
  const items: Mission[] = list.data.items;
  const done = items.filter((m) => m.state === "done").length;
  const taken = items.filter((m) => m.state === "taken").length;

  return (
    <PageFrame className="gap-8">
      <Rise as="header" i={0} className="flex flex-col gap-4 @4xl:flex-row @4xl:items-end @4xl:justify-between">
        <div className="min-w-0">
          <Link href={`/family/${memberId}/people`} className="mb-2 inline-flex min-h-11 items-center gap-1 text-label text-muted-foreground hover:text-ink md:min-h-0">
            <ChevronLeft aria-hidden className="size-4" />
            People
          </Link>
          <h1 className="text-headline">Missions {stageWords[list.data.stage]}</h1>
          <p className="mt-1.5 max-w-prose text-body text-ink-2">
            {done + taken > 0 ? `${done} finished, ${taken} on the go. ` : ""}Small jobs that make the next weeks easier. Take one, finish it, or swap it for another. Either of you can take any of them.
          </p>
        </div>
        {stickers.data && <StickerShelf items={stickers.data.items} memberId={memberId} className="self-start @4xl:self-auto" />}
      </Rise>
      <Rise i={1}>
        <MissionBoard memberId={memberId} initial={items} people={people} shown={6} />
      </Rise>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
