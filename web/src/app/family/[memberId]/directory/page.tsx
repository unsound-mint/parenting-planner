import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SearchX, WifiOff } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import type { ProviderType } from "@/lib/api/types";
import { countWord } from "@/lib/format";
import { providerTypeLabel, providerTypes } from "@/lib/visuals";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { ProviderCard, whenLabel } from "@/components/directory/provider-card";
import { RequestsCard } from "@/components/directory/requests-card";

// Provider directory: synthetic providers by type and state, with a booking
// request that is saved and shown as "Requested". Filters are URL search
// params (?type=perinatal_therapist&state=CA) so the plan can link here.
export default function DirectoryPage({ params, searchParams }: PageProps<"/family/[memberId]/directory">) {
  return (
    <Suspense fallback={<DirectoryFallback />}>
      <Directory params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Directory({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { memberId } = await params;
  await requireParent(memberId);
  const sp = await searchParams;
  const typeParam = typeof sp.type === "string" ? sp.type : undefined;
  const stateParam = typeof sp.state === "string" ? sp.state : undefined;
  const type = providerTypes.find((t) => t === typeParam);
  const state = stateParam && /^[A-Z]{2}$/.test(stateParam) ? stateParam : undefined;

  const api = await serverApi();
  const [all, shown, requests] = await Promise.all([
    api.GET("/providers"),
    api.GET("/providers", { params: { query: { type, state } } }),
    api.GET("/members/{memberId}/booking-requests", { params: { path: { memberId } } }),
  ]);
  if (all.response.status === 404 || requests.response.status === 404) notFound();

  const base = `/family/${memberId}/directory`;
  const everyone = all.data?.items ?? [];
  const items = shown.data?.items ?? [];
  const requested = new Set((requests.data?.items ?? []).map((r) => r.providerId));
  const failed = !all.data || !shown.data;

  // Filter options come from the unfiltered list so they do not vanish once picked.
  const states = [...new Set(everyone.map((p) => p.state))].sort();
  const counts: Partial<Record<ProviderType, number>> = {};
  for (const p of everyone) if (!state || p.state === state) counts[p.type] = (counts[p.type] ?? 0) + 1;

  return (
    <main className="grid flex-1 content-start gap-8 px-4 pt-6 pb-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="directory-headline" className="min-w-0">
        <h1 id="directory-headline" className="max-w-2xl text-headline text-balance">
          {headline(items, type, failed)}
        </h1>
        <p className="mt-2 text-label font-normal text-muted-foreground">
          Demo providers, made up for this app. A request is saved, nothing is sent.
        </p>

        {!failed && <DirectoryFilters base={base} type={type} state={state} states={states} counts={counts} />}

        {failed ? (
          <Empty icon={WifiOff} title="The directory did not load." hint="Your plan is not affected. Try again in a moment.">
            <Link href={base} className="text-label font-semibold text-primary underline-offset-4 hover:underline">
              Try again
            </Link>
          </Empty>
        ) : items.length === 0 ? (
          <Empty icon={SearchX} title="No one matches these filters." hint="Try another type or any state.">
            <Link href={base} className="text-label font-semibold text-primary underline-offset-4 hover:underline">
              Show everyone
            </Link>
          </Empty>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((p, i) => (
              <ProviderCard key={p.id} provider={p} memberId={memberId} requested={requested.has(p.id)} soonest={i === 0 && items.length > 1} />
            ))}
          </ul>
        )}
      </section>

      {!failed && requests.data && (
        <aside className="lg:pt-1">
          <RequestsCard requests={requests.data.items} providers={everyone} />
        </aside>
      )}
    </main>
  );
}

function headline(items: { type: ProviderType; nextAvailable: string }[], type: ProviderType | undefined, failed: boolean): string {
  if (failed) return "We could not load the directory.";
  if (items.length === 0) return "No one matches yet.";
  // Sorted soonest first by the API.
  const first = whenLabel(items[0].nextAvailable);
  const n = items.length;
  if (type) {
    const label = providerTypeLabel[type];
    return n === 1 ? `One ${label.one.toLowerCase()} is free ${first}.` : `${countWord(n)} ${label.many.toLowerCase()}, the first free ${first}.`;
  }
  return `${countWord(n)} ${n === 1 ? "provider" : "providers"}, the first free ${first}.`;
}

function Empty({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-title">{title}</p>
        <p className="mt-1 text-label text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function DirectoryFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
