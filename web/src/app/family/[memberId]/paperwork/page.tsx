import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { familyPeople } from "@/lib/roles";
import { PaperworkHub } from "@/components/paperwork/paperwork-hub";

// "Family paperwork": what to prepare next in the US, from the birth certificate
// to workplace rights and benefit programs. Parents only; the API answers 404
// for a caregiver too. The checklist is the family's paperwork tasks, shared by
// both parents.
export default function PaperworkPage({ params }: PageProps<"/family/[memberId]/paperwork">) {
  return (
    <Suspense fallback={<PaperworkFallback />}>
      <Paperwork params={params} />
    </Suspense>
  );
}

async function Paperwork({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [{ data: family, response }, { data: hub }] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/family-paperwork", { params: { path: { memberId } } })]);
  if (response.status === 401) redirect("/");
  if (!family || !hub) notFound();
  return <PaperworkHub hub={hub} people={familyPeople(family)} selfId={memberId} childName={family.children[0]?.name} />;
}

function PaperworkFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-48 animate-pulse rounded-3xl bg-muted" />
      <div className="mt-6 h-72 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
