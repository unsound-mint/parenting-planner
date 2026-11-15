import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { PageFrame } from "@/components/shell/page";
import { QuizDecks } from "@/components/learn/quiz-decks";

// Quiz decks: every lesson question of the family's paths, one deck per path,
// with where each parent stands and the missed ones to review. The answers are
// the ones Learn saves; nothing here is scored or invented.
export default function QuizzesPage({ params, searchParams }: PageProps<"/family/[memberId]/learn/quizzes">) {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-4 pt-6 md:px-8" aria-busy>
          <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        </main>
      }
    >
      <Quizzes params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Quizzes({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { memberId } = await params;
  const { deck } = await searchParams;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, paths, attempts] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/learning-paths", path), api.GET("/members/{memberId}/quiz-attempts", path)]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !paths.data) notFound();
  if (inLossSupport(family.data)) notFound();
  const me = family.data.parents.find((p) => p.id === memberId);
  if (!me) notFound();
  const them = family.data.parents.find((p) => p.id !== memberId);
  return (
    <PageFrame className="gap-8">
      <QuizDecks key={memberId} memberId={memberId} couple={{ me, them }} initialPaths={paths.data.items} initialAttempts={attempts.data?.items ?? []} initialDeck={typeof deck === "string" ? deck : undefined} />
    </PageFrame>
  );
}
