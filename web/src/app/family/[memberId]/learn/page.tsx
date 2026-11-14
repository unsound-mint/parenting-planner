import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { requireParent } from "@/lib/guard";
import { countWord, familyContext } from "@/lib/format";
import { lessonAction, lessonsFor } from "@/lib/learn";
import { inLossSupport } from "@/lib/loss";
import { LessonCard } from "@/components/learn/lesson-card";

// Learn: short lessons for this person's stage and role (the API filters), each
// ending in one action. A lesson that is already a plan item on This week is
// left out (lib/week.ts), and one already acted on shows as done.
export default function LearnPage({ params }: PageProps<"/family/[memberId]/learn">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Learn params={params} />
    </Suspense>
  );
}

async function Learn({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, guides, plan, tasks, questions] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/guides", { params: { path: { memberId }, query: { kind: "article" } } }),
    api.GET("/members/{memberId}/plan", path),
    optional(api.GET("/members/{memberId}/tasks", path)),
    optional(api.GET("/members/{memberId}/appointment-questions", path)),
  ]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !guides.data) notFound();
  // Pregnancy loss support has its own card on This week instead of stage lessons.
  if (inLossSupport(family.data)) notFound();

  const lessons = lessonsFor(guides.data.items, plan.data?.items ?? []);
  const onlyFor = (audience: string[]) => (audience.length === 1 && audience[0] === "partner" ? "For partners" : audience.length === 1 && audience[0] === "mother" ? "For mothers" : undefined);
  const taskTitles = new Set((tasks?.items ?? []).map((t) => t.title));
  const asked = new Set((questions?.items ?? []).filter((q) => q.authorId === memberId).map((q) => q.text));

  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <h1 className="max-w-2xl text-headline text-balance">
        {lessons.length === 0 ? "You are up to date on lessons." : `${countWord(lessons.length)} short ${lessons.length === 1 ? "lesson" : "lessons"} for you right now.`}
      </h1>
      <p className="mt-2 text-label font-normal text-muted-foreground">{familyContext(family.data)}</p>
      {lessons.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {lessons.map((g) => {
            const action = lessonAction(g);
            const done = action.kind === "task" ? taskTitles.has(action.title) : action.kind === "question" ? asked.has(action.text) : false;
            return <LessonCard key={g.id} memberId={memberId} guide={g} action={action} done={done} audience={onlyFor(g.audience)} />;
          })}
        </ul>
      )}
    </main>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
