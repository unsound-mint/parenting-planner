import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { HospitalMode } from "@/components/hospital/hospital-mode";
import { ContractionTimer } from "@/components/labor/contraction-timer";
import { BreathingGuide } from "@/components/labor/breathing-guide";
import { RealOrPractice } from "@/components/labor/real-or-practice";
import { BirthPrep } from "@/components/labor/birth-prep";
import { showsLaborCoach } from "@/components/labor/labor-coach-link";

// "Getting ready for birth": the contraction timer and when to call (the hero,
// first on a phone), how labor contractions differ from practice ones, guided
// breathing, a short list for the weeks before, and the "Going to the
// hospital" cards. Parents in a pregnancy only; not in pregnancy loss support.
// The hospital cards need the birth plan (501 until the backend lands, then
// preview mocks); without it the rest of the page still stands.
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
  const [{ data: family, response }, { data: plan }, { data: tasks }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/birth-plan", path),
    api.GET("/members/{memberId}/tasks", path),
  ]);
  if (response.status === 401) redirect("/");
  const self = family && familyPeople(family).find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !self) redirect("/family");
  if (!family || !self) notFound();
  if (isCaregiver(self.role)) redirect(`/family/${memberId}`);
  if (!showsLaborCoach(family)) notFound();

  const other = family.parents.find((p) => p.id !== memberId);
  const birthParent = family.parents.find((p) => p.role === "mother") ?? self;
  const week = family.gestationalWeek ?? undefined;
  const all = tasks?.items ?? [];
  const bags = tasks ? all.filter((t) => t.kind === "hospital_bag") : undefined;
  // The number to call in labor: the first contact that is a place, not one of the parents.
  const desk = plan?.contacts.find((c) => !c.memberId);

  return (
    <PageFrame>
      <Rise as="header" i={0}>
        <h1 className="text-headline text-balance">Getting ready for birth</h1>
        <p className="mt-1 text-label font-normal text-muted-foreground">A guide for both of you. Your care team&apos;s instructions always come first.</p>
      </Rise>

      {/* Not wrapped in Rise: the call card holds the Urgent help link, which never
          animates. The timer, explainer and breathing cards rise on their own. */}
      <PageGrid cols={3}>
        <ContractionTimer familyId={family.id} memberId={memberId} week={week} call={desk && { name: desk.label, phone: desk.phone }} />
        <RealOrPractice />
        <BreathingGuide birthParent={birthParent.displayName} isBirthParent={self.id === birthParent.id} week={week} />
      </PageGrid>

      <Rise i={4} as="section" aria-labelledby="hospital-title" id="hospital" className="scroll-mt-24">
        <h2 id="hospital-title" className="text-headline">
          Before the day, and going in
        </h2>
        <PageGrid cols={3} className="mt-4">
          <BirthPrep memberId={memberId} plan={plan} tasks={all} birthParent={birthParent.displayName} />
          {plan && <HospitalMode plan={plan} bags={bags} memberId={memberId} partner={other && { id: other.id, name: other.displayName }} />}
        </PageGrid>
      </Rise>
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
