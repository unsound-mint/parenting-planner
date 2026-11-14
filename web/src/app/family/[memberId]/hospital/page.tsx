import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { PageFrame } from "@/components/shell/page";
import { HospitalMode } from "@/components/hospital/hospital-mode";

// "Going to the hospital": the screen for the moment labour starts. Parents only.
// Without a birth plan (501 in production until the backend lands, 404 for a
// caregiver or in pregnancy loss support) the screen is not offered.
export default function HospitalPage({ params }: PageProps<"/family/[memberId]/hospital">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Hospital params={params} />
    </Suspense>
  );
}

async function Hospital({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: plan }, { data: tasks }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/birth-plan", path),
    api.GET("/members/{memberId}/tasks", { params: { path: { memberId }, query: { kind: "hospital_bag" } } }),
  ]);
  const self = family && familyPeople(family).find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !self) redirect("/family");
  if (!family || !self || isCaregiver(self.role) || !plan) notFound();
  const other = family.parents.find((p) => p.id !== memberId);

  return (
    <PageFrame>
      <h1 className="text-headline text-balance">Going to the hospital</h1>
      <HospitalMode plan={plan} bags={tasks?.items} memberId={memberId} partner={other && { id: other.id, name: other.displayName }} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-56 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
