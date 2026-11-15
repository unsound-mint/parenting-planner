import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { PageFrame } from "@/components/shell/page";
import { ManualPlayer } from "@/components/manuals/manual-player";

// One hands-on manual (swaddle, burp, safe sleep), played step by step.
export default function ManualPage({ params }: PageProps<"/family/[memberId]/simulator/manuals/[manualId]">) {
  return (
    <Suspense fallback={<PageFrame aria-busy><div className="aspect-[4/3] max-w-3xl animate-pulse rounded-3xl bg-muted" /></PageFrame>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ memberId: string; manualId: string }> }) {
  const { memberId, manualId } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/members/{memberId}/manuals", { params: { path: { memberId } } });
  const manual = data?.items.find((m) => m.id === manualId);
  if (!manual) notFound();
  return (
    <PageFrame>
      <h1 className="text-title text-muted-foreground">{manual.title}</h1>
      <ManualPlayer manual={manual} memberId={memberId} />
    </PageFrame>
  );
}
