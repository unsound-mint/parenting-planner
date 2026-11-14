import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { inLossSupport } from "@/lib/loss";
import { cn } from "@/lib/utils";
import { categoryOf } from "./visuals";

/**
 * A small card for This week: three questions parents ask at the family's
 * week or age, each opening its answer in the Questions library. Renders
 * nothing for caregivers (the API answers 404), in pregnancy loss support, or
 * when the library cannot load. Self-contained: it suspends on its own.
 */
export function QuestionsNow({ memberId, className }: { memberId: string; className?: string }) {
  return (
    <Suspense fallback={null}>
      <QuestionsNowCard memberId={memberId} className={className} />
    </Suspense>
  );
}

async function QuestionsNowCard({ memberId, className }: { memberId: string; className?: string }) {
  const api = await serverApi();
  const [family, library] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/library-topics", { params: { path: { memberId } } })]);
  if (!family.data || !library.data || inLossSupport(family.data)) return null;
  const now = library.data.items.filter((t) => t.now && !t.urgent).slice(0, 3);
  if (now.length === 0) return null;
  const base = `/family/${memberId}/learn/questions`;
  return (
    <section aria-labelledby="questions-now-title" className={cn("min-w-0 rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7", className)}>
      <p className="text-caption font-semibold tracking-wider text-muted-foreground uppercase">Parents ask at this point</p>
      <h2 id="questions-now-title" className="mt-1 text-title">
        {library.data.position}
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        {now.map((t) => {
          const Icon = categoryOf(t.category).icon;
          return (
            <li key={t.id}>
              <Link href={`${base}?topic=${t.id}`} className="press lift flex min-h-11 items-center gap-3 rounded-2xl bg-muted px-3.5 py-2.5 text-label font-normal text-ink">
                <Icon className="size-4 shrink-0 text-me" aria-hidden />
                <span className="min-w-0 flex-1">{t.questions[0] ?? t.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={base} className="mt-4 inline-flex items-center gap-1.5 text-label text-me underline decoration-me/30 underline-offset-3 hover:decoration-me">
        <MessageCircleQuestion className="size-4" aria-hidden />
        All questions, or ask your own privately
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
