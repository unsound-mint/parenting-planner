import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { countThings } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { AllergiesCard } from "@/components/passport/allergies-card";
import { CareTeamCard } from "@/components/passport/care-team-card";
import { GrowthCard } from "@/components/passport/growth-card";
import { LabsCard } from "@/components/passport/labs-card";
import { NextStep } from "@/components/passport/next-step";
import { PersonTabs } from "@/components/passport/person-tabs";
import { summarize } from "@/components/passport/summary";
import { VaccineTimeline } from "@/components/passport/vaccine-timeline";

// Health passport: labs, vaccines, allergies, growth and care team for each
// person. The API decides what the acting parent may see; this page draws it.
export default function PassportPage({ params, searchParams }: PageProps<"/family/[memberId]/passport">) {
  return (
    <Suspense fallback={<PassportFallback />}>
      <Passport params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Passport({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ person?: string | string[] }>;
}) {
  const { memberId } = await params;
  await requireParent(memberId);
  const { person: personParam } = await searchParams;
  const api = await serverApi();
  const { data, response } = await api.GET("/members/{memberId}/passport", { params: { path: { memberId } } });
  if (response.status === 401) redirect("/");
  if (response.status === 404) notFound();
  if (!data || data.people.length === 0) return <PassportEmpty />;

  const wanted = Array.isArray(personParam) ? personParam[0] : personParam;
  const person = data.people.find((p) => p.id === wanted) ?? data.people[0];
  const summary = summarize(person);
  const attention = summary.vaccinesNeeded + summary.labsOutside + summary.suspectedAllergies;
  const owner = person.isActingParent ? "your" : `${person.name}'s`;
  const headline =
    attention === 0
      ? `${person.isActingParent ? "Your" : `${person.name}'s`} passport is up to date. Nothing to ask about.`
      : `${countThings(attention)} in ${owner} passport ${attention === 1 ? "is" : "are"} worth a look.`;
  const showVisibility = person.isActingParent;

  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
      <div className="mt-4">
        <PersonTabs people={data.people} selectedId={person.id} base={`/family/${memberId}/passport`} />
      </div>
      {person.kind === "parent" && !person.isActingParent && (
        <p className="mt-3 flex items-center gap-2 text-label text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          Only what {person.name} has shared with you is shown here.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <NextStep person={person} focus={summary.focus} />
          <LabsCard labs={person.labs} showVisibility={showVisibility} />
          <VaccineTimeline vaccines={person.vaccines} />
        </div>
        <aside className="flex flex-col gap-6">
          <AllergiesCard allergies={person.allergies} />
          {person.kind === "child" && <GrowthCard growth={person.growth} />}
          <CareTeamCard members={person.careTeam} />
        </aside>
      </div>
    </main>
  );
}

// Shown while the passport is not available (any non-OK answer except 401 and 404): calm, no error text.
function PassportEmpty() {
  const sections = [passportIcon.labs, passportIcon.vaccines, passportIcon.allergies, passportIcon.growth, passportIcon.careTeam];
  return (
    <main className="flex-1 px-4 pt-6 pb-16 md:px-8">
      <h1 className="max-w-2xl text-headline text-balance">Your family&apos;s health passport is empty for now.</h1>
      <div className="mt-8 flex max-w-2xl flex-col items-center gap-5 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <div className="flex gap-3" aria-hidden>
          {sections.map((Icon, i) => (
            <span key={i} className="flex size-11 items-center justify-center rounded-full bg-status-up-soft text-status-up">
              <Icon className="size-5" />
            </span>
          ))}
        </div>
        <p className="max-w-sm text-body text-muted-foreground">Labs, vaccines, allergies, growth and your care team appear here once they are recorded. Check back soon.</p>
      </div>
    </main>
  );
}

function PassportFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 w-28 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
