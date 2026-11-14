import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { PageFrame } from "@/components/shell/page";
import { LabBoard } from "@/components/lab/lab-board";

// Parenting Compatibility Lab, inside Learn. Scenario cards each parent answers
// alone; the answers show only once both answered. Never a score.
export default function LabPage({ params }: PageProps<"/family/[memberId]/learn/lab">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Lab params={params} />
    </Suspense>
  );
}

async function Lab({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [family, lab] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/lab", { params: { path: { memberId } } })]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !lab.data || inLossSupport(family.data)) notFound();
  const me = family.data.parents.find((p) => p.id === memberId);
  const them = family.data.parents.find((p) => p.id !== memberId);
  // The lab needs two people; a single-parent family has no one to compare with.
  if (!me || !them) notFound();
  return (
    <PageFrame className="gap-8">
      <LabBoard key={memberId} memberId={memberId} me={me} them={them} initialCards={lab.data.cards} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-56 animate-pulse rounded-[2rem] bg-muted" />
      <div className="h-64 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
