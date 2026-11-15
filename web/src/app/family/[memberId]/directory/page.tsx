import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SearchX, WifiOff } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import type { ProviderType, VisitMode } from "@/lib/api/types";
import { countWord } from "@/lib/format";
import { providerTypes, visitModes } from "@/lib/visuals";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { PartnerOffers } from "@/components/offers/partner-offers";
import { ProviderCard } from "@/components/directory/provider-card";
import { YourVisits } from "@/components/directory/your-visits";
import { recommend, type Recommendation } from "@/components/directory/recommend";
import { firstOpenings, openingLabel } from "@/components/directory/openings";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { familyNow } from "@/lib/clock";
import { cn } from "@/lib/utils";

// Provider directory: synthetic providers with real open times stored per
// family. The parent's booked visits first, then picks for the family's
// situation, then everyone with filters. Filters are URL search params
// (?type=perinatal_therapist&state=TX&mode=video) so the plan and the care
// screen can link here; a provider's profile and times are at ./[providerId].
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
  const type = providerTypes.find((t) => t === sp.type) as ProviderType | undefined;
  const mode = visitModes.find((m) => m === sp.mode) as VisitMode | undefined;
  const state = typeof sp.state === "string" && /^[A-Z]{2}$/.test(sp.state) ? sp.state : undefined;

  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [all, slots, bookings, patterns, family, offers] = await Promise.all([
    api.GET("/providers"),
    api.GET("/members/{memberId}/provider-slots", path),
    api.GET("/members/{memberId}/provider-bookings", path),
    // No pattern means recommendations come from the family's stage alone.
    api.GET("/members/{memberId}/mood-patterns", path),
    api.GET("/family"),
    api.GET("/members/{memberId}/partner-offers", path),
  ]);
  if (all.response.status === 404 || slots.response.status === 404) notFound();

  const base = `/family/${memberId}/directory`;
  const everyone = all.data?.items ?? [];
  const openings = firstOpenings(slots.data?.items ?? []);
  const failed = !all.data || !slots.data;
  const now = family.data ? familyNow(family.data) : new Date();
  const partnerName = family.data?.parents.find((p) => p.id !== memberId)?.displayName;

  const visits = bookings.data?.items ?? [];
  const upcoming = visits.filter((b) => new Date(b.startsAt).getTime() > now.getTime());
  const picks = recommend(everyone, openings, patterns.data?.items[0], family.data?.stage, upcoming.map((b) => b.providerId));
  // Soonest opening first; no opening sorts last ("~" is after any ISO time).
  const soon = (id: string) => openings.get(id)?.startsAt ?? "~";
  const fits = (p: (typeof everyone)[number]) => (!state || p.state === state) && (!mode || p.visitModes.includes(mode));
  const shown = everyone.filter((p) => fits(p) && (!type || p.type === type)).sort((a, b) => soon(a.id).localeCompare(soon(b.id)) || a.name.localeCompare(b.name));

  // Filter options come from the unfiltered list so they do not vanish once picked.
  const states = [...new Set(everyone.map((p) => p.state))].sort();
  const counts: Partial<Record<ProviderType, number>> = {};
  for (const p of everyone) if (fits(p)) counts[p.type] = (counts[p.type] ?? 0) + 1;
  const hasVisits = upcoming.length > 0;
  // Unfiltered, the list leaves out the picks above so no one shows twice; once a
  // filter is on (often a link from the plan), every match shows, picks included.
  const filtering = !!(type || mode || state);
  const picked = new Set(picks.map((r) => r.provider.id));
  const listed = filtering ? shown : shown.filter((p) => !picked.has(p.id));
  // Four columns on a wide screen, unless three fill the last row and four would not.
  const cols = listed.length % 4 !== 0 && listed.length % 4 < 3 && listed.length % 3 === 0 ? "@[84rem]:grid-cols-3" : "@[84rem]:grid-cols-4";

  return (
    <PageFrame>
      <Rise as="header" i={0}>
        <h1 className="text-headline">Find help</h1>
        <p className="mt-1.5 max-w-prose text-body text-ink-2">{subtitle(picks, failed, now)}</p>
        <p className="mt-2 max-w-prose text-caption text-muted-foreground">
          Demo providers and times. A booking stays here and on your calendar; nothing is sent to anyone.
        </p>
      </Rise>

      {failed ? (
        <Empty icon={WifiOff} title="The directory did not load." hint="Your plan is not affected. Try again in a moment.">
          <Link href={base} className="text-label font-semibold text-primary underline-offset-4 hover:underline">
            Try again
          </Link>
        </Empty>
      ) : (
        <>
          {hasVisits && (
            <Rise as="section" i={1} aria-labelledby="visits-heading">
              <h2 id="visits-heading" className="text-title font-semibold">
                Your visits
              </h2>
              <YourVisits memberId={memberId} bookings={visits} partnerName={partnerName} now={now} className="mt-3 @7xl:grid @7xl:grid-cols-2 @7xl:gap-3" />
            </Rise>
          )}

          {picks.length > 0 && (
            <Rise as="section" i={2} aria-labelledby="picks-heading">
              <h2 id="picks-heading" className="text-title font-semibold">
                Suggested for you now
              </h2>
              {/* Two picks (a visit is already booked) fill two columns instead of leaving a third one empty. */}
              <ul className={cn("mt-3 grid gap-4 @3xl:grid-cols-2", picks.length !== 2 && "@7xl:grid-cols-3")}>
                {picks.map((r) => (
                  <ProviderCard key={r.provider.id} provider={r.provider} href={`${base}/${r.provider.id}`} first={r.first} reason={r.reason} featured now={now} />
                ))}
              </ul>
            </Rise>
          )}

          <Rise as="section" i={3} aria-labelledby="all-heading" className="border-t border-line pt-6">
            <h2 id="all-heading" className="flex items-baseline gap-2 text-title font-semibold">
              {filtering || picks.length === 0 ? "Everyone" : "Everyone else"}
              <span className="font-mono text-label font-normal text-muted-foreground">{listed.length}</span>
            </h2>
            <div className="mt-3">
              <DirectoryFilters base={base} type={type} state={state} mode={mode} states={states} counts={counts} />
            </div>
            {listed.length === 0 ? (
              <Empty icon={SearchX} title="No one matches these filters." hint="Try another type, any state or any way of meeting.">
                <Link href={base} className="text-label font-semibold text-primary underline-offset-4 hover:underline">
                  Show everyone
                </Link>
              </Empty>
            ) : (
              <ul className={cn("mt-4 grid items-stretch gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3", cols)}>
                {listed.map((p) => (
                  <ProviderCard key={p.id} provider={p} href={`${base}/${p.id}`} first={openings.get(p.id)} reason={filtering && picked.has(p.id) ? "Suggested for you above" : undefined} now={now} />
                ))}
              </ul>
            )}
          </Rise>
        </>
      )}
      {/* Shown only when the endpoint answers; offers never touch the provider picks above. */}
      {offers.data && <PartnerOffers offers={offers.data.items.slice(0, 3)} />}
    </PageFrame>
  );
}

/** "tomorrow at 10:00 AM", "Mon at 4:00 PM" inside a sentence. */
const inSentence = (label: string) => label.replace(/^(Today|Tomorrow)/, (m) => m.toLowerCase()).replace(/,? (\d{1,2}:\d{2})/, " at $1");

function subtitle(picks: Recommendation[], failed: boolean, now: Date): string {
  if (failed) return "We could not load the directory.";
  const first = picks.map((r) => r.first?.startsAt).filter((s): s is string => !!s).sort()[0];
  if (!first) return "Doulas, lactation help, therapists and more, with real open times.";
  if (picks[0].pattern && picks[0].first) return `Someone to talk to, free ${inSentence(openingLabel(picks[0].first.startsAt, now))}.`;
  return `${countWord(picks.length)} good ${picks.length === 1 ? "fit" : "fits"} for right now, the first free ${inSentence(openingLabel(first, now))}.`;
}

function Empty({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6">
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
      <div className="h-10 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
