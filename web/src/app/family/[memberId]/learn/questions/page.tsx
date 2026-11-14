import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { PageFrame } from "@/components/shell/page";
import { LibraryBoard } from "@/components/library/library-board";

// Questions parents ask: the research atlas as a searchable library, the
// family's current week or age first. Every answer is our plain writing from
// the cited page, with an evidence label; nothing is generated. A parent's own
// question goes, private, to their next appointment or psychologist session.
export default function QuestionsPage({ params, searchParams }: PageProps<"/family/[memberId]/learn/questions">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Questions params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Questions({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { memberId } = await params;
  const query = await searchParams;
  await requireParent(memberId);
  const api = await serverApi();
  const [family, library] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/library-topics", { params: { path: { memberId } } })]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !library.data) notFound();
  // Like Learn: after a pregnancy loss the stage library is not offered (the nav hides Learn too).
  if (inLossSupport(family.data)) notFound();
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  return (
    <PageFrame className="gap-8">
      <LibraryBoard
        key={memberId}
        memberId={memberId}
        stage={family.data.stage}
        position={library.data.position}
        items={library.data.items}
        initialTopic={one(query.topic)}
        initialQuery={one(query.q)}
      />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-72 animate-pulse rounded-[2.25rem] bg-muted" />
      <div className="grid gap-6 @4xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        <div className="hidden h-80 animate-pulse rounded-3xl bg-muted @4xl:block" />
      </div>
    </main>
  );
}
