import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { inLossSupport } from "@/lib/loss";
import { PageFrame } from "@/components/shell/page";
import { ManualPlayer } from "@/components/manuals/manual-player";

// One hands-on manual (swaddle, burp, safe sleep), played step by step.
export default function ManualPage({ params, searchParams }: PageProps<"/family/[memberId]/simulator/manuals/[manualId]">) {
  return (
    <Suspense fallback={<PageFrame aria-busy><div className="aspect-[4/3] max-w-3xl animate-pulse rounded-3xl bg-muted" /></PageFrame>}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: { params: Promise<{ memberId: string; manualId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ memberId, manualId }, query] = await Promise.all([params, searchParams]);
  // ?step=N opens a given step (1-based; one past the last is the self-check).
  const step = Number(query.step) - 1;
  const api = await serverApi();
  const [{ data }, { data: family }] = await Promise.all([
    api.GET("/members/{memberId}/manuals", { params: { path: { memberId } } }),
    api.GET("/family"),
  ]);
  const manual = data?.items.find((m) => m.id === manualId);
  // Like the Practice page: no baby prep while the family is in pregnancy loss support.
  if (!manual || (family && inLossSupport(family))) notFound();
  return (
    <PageFrame>
      <h1 className="text-title text-muted-foreground">{manual.title}</h1>
      <ManualPlayer manual={manual} memberId={memberId} initialStep={Number.isInteger(step) && step > 0 ? Math.min(step, manual.steps.length) : 0} />
    </PageFrame>
  );
}
