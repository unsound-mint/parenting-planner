import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { BabyHome } from "@/components/baby/baby-home";
import { ChildHome } from "@/components/child/child-home";
import { CapsuleLink } from "@/components/capsule/capsule-link";
import { hasOlderChild } from "@/lib/stage";

// "Baby": the same care screen a nanny gets as her home, for the parents. They
// log feeds, sleeps and diapers here and start the handoff the nanny accepts.
export default function BabyPage({ params }: PageProps<"/family/[memberId]/baby">) {
  return (
    <Suspense fallback={<BabyFallback />}>
      <Baby params={params} />
    </Suspense>
  );
}

async function Baby({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  if (!family) notFound();
  // Past toddler age the baby log (feeds, diapers) does not apply: show the child's own screen.
  const home = hasOlderChild(family) ? <ChildHome memberId={memberId} family={family} /> : <BabyHome memberId={memberId} family={family} />;
  // Letters to the child are parents only: a nanny opens this screen as her home and never sees the link.
  const parent = family.parents.some((p) => p.id === memberId);
  return (
    <>
      {home}
      {parent && (
        <div className="px-4 pb-16 md:px-8">
          <Suspense fallback={null}>
            <CapsuleLink memberId={memberId} childName={family.children[0]?.name} />
          </Suspense>
        </div>
      )}
    </>
  );
}

function BabyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-32 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
