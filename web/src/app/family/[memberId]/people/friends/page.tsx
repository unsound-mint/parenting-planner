import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { PageFrame } from "@/components/shell/page";
import { FriendsBoard } from "@/components/friends/friends-board";

// Friend families: other families this one connected with by a code, both
// agreeing. They see only what a parent shares here, one item at a time; never
// the journal, moods, health or the plan. Preset reactions only, no comments,
// counts or messages. Parents only: caregivers get 404 from the API too.
export default function FriendsPage({ params }: PageProps<"/family/[memberId]/people/friends">) {
  return (
    <Suspense fallback={<Fallback />}>
      <FriendsScreen params={params} />
    </Suspense>
  );
}

async function FriendsScreen({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [family, friends] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/friends", { params: { path: { memberId } } })]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !friends.data) notFound();
  const me = family.data.parents.find((p) => p.id === memberId);
  return (
    <PageFrame>
      <FriendsBoard memberId={memberId} myName={me?.displayName ?? ""} stage={family.data.stage} friends={friends.data} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-64 animate-pulse rounded-[2.25rem] bg-muted" />
      <div className="grid gap-6 @4xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        <div className="hidden h-72 animate-pulse rounded-3xl bg-muted @4xl:block" />
      </div>
    </main>
  );
}
