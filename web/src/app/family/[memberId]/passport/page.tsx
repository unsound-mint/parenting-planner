import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { PassportBody } from "@/components/passport/passport-body";
import { passportIcon } from "@/lib/visuals";
import { PageFrame } from "@/components/shell/page";

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
  return <PassportBody memberId={memberId} people={data.people} personId={person.id} />;
}

// Shown while the passport is not available (any non-OK answer except 401 and 404): calm, no error text.
function PassportEmpty() {
  const sections = [passportIcon.labs, passportIcon.vaccines, passportIcon.allergies, passportIcon.growth, passportIcon.careTeam];
  return (
    <PageFrame className="block">
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
    </PageFrame>
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
