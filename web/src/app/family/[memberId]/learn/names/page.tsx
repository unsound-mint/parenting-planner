import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { NamesQuestBoard } from "@/components/names/names-quest-board";

// The names quest under Learn: both parents swipe names on their own, names
// both love become the shortlist, and a final round ends in their top three.
// Parents only (caregivers are sent home, the API answers them 404), and only
// before the birth (the API answers 409 quest_closed, which is a 404 here).
export default function NamesPage({ params }: PageProps<"/family/[memberId]/learn/names">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Names params={params} />
    </Suspense>
  );
}

async function Names({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, quest, deck] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/names-quest", path),
    api.GET("/members/{memberId}/names-quest/deck", path),
  ]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !quest.data || !deck.data) notFound();
  const me = family.data.parents.find((p) => p.id === memberId);
  if (!me) notFound();
  const them = family.data.parents.find((p) => p.id !== memberId);

  return (
    <PageFrame className="gap-6">
      <Rise as="header" i={0}>
        <h1 className="text-headline">Find a name together</h1>
        <p className="mt-1.5 max-w-prose text-body text-ink-2">
          {them
            ? `Swipe on your own. ${them.displayName} sees how you answered a name only after answering it too, and names you both love land on your shortlist.`
            : "Swipe on your own, and names you love land on your shortlist."}
        </p>
      </Rise>
      <Rise i={1}>
        <NamesQuestBoard memberId={memberId} couple={{ me, them }} initialQuest={quest.data} initialDeck={deck.data} />
      </Rise>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-3xl bg-muted" />
      <div className="mx-auto h-[26rem] w-full max-w-md animate-pulse rounded-[1.75rem] bg-muted" />
    </main>
  );
}
