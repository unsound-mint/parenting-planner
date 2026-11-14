import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, DollarSign, Languages, MapPin } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { familyNow } from "@/lib/clock";
import { formatClock, formatDayNumber, formatMonth, formatWeekday } from "@/lib/format";
import { providerTypeIcon, providerTypeLabel, visitModeIcon, visitModeLabel } from "@/lib/visuals";
import type { BookingVisibility, ProviderType } from "@/lib/api/types";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { Chip, NextOpening, initials } from "@/components/directory/provider-card";
import { SlotPicker } from "@/components/directory/slot-picker";
import { YourVisits } from "@/components/directory/your-visits";

// Talk-therapy visits default to private: a parent widens them on purpose.
const privateByDefault: ProviderType[] = ["perinatal_therapist", "psychologist"];

// One provider: a short profile beside their open times for the next two
// weeks. ?move=<bookingId> turns the picker into a reschedule of that visit.
export default function ProviderPage({ params, searchParams }: PageProps<"/family/[memberId]/directory/[providerId]">) {
  return (
    <Suspense fallback={<ProviderFallback />}>
      <Provider params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Provider({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string; providerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { memberId, providerId } = await params;
  await requireParent(memberId);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(providerId)) notFound();

  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [providers, slots, bookings, family] = await Promise.all([
    api.GET("/providers"),
    api.GET("/members/{memberId}/provider-slots", { params: { path: { memberId }, query: { providerId } } }),
    api.GET("/members/{memberId}/provider-bookings", path),
    api.GET("/family"),
  ]);
  const p = providers.data?.items.find((x) => x.id === providerId);
  if (!p || !family.data) notFound();

  const now = familyNow(family.data);
  const partnerName = family.data.parents.find((x) => x.id !== memberId)?.displayName;
  const mine = (bookings.data?.items ?? []).filter((b) => b.providerId === p.id && new Date(b.startsAt).getTime() > now.getTime());
  const move = typeof sp.move === "string" ? mine.find((b) => b.id === sp.move && b.memberId === memberId) : undefined;
  const open = slots.data?.items ?? [];
  const TypeIcon = providerTypeIcon[p.type];
  const defaultVisibility: BookingVisibility = privateByDefault.includes(p.type) ? "private" : "family";

  return (
    <PageFrame>
      <Rise i={0}>
        <Link
          href={`/family/${memberId}/directory`}
          className="press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All providers
        </Link>
      </Rise>

      <div className="grid min-w-0 items-start gap-6 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Rise as="section" i={1} aria-labelledby="provider-name">
          <SoftCard className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-them-soft text-headline text-them">
                {initials(p.name)}
              </span>
              <div className="min-w-0">
                <h1 id="provider-name" className="text-headline">
                  {p.name}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-label font-normal text-muted-foreground">
                  <TypeIcon className="size-4 shrink-0" aria-hidden />
                  {providerTypeLabel[p.type].one}
                  {p.credentials && <span>· {p.credentials}</span>}
                </p>
              </div>
            </div>
            <p className="max-w-prose text-body text-ink-2">{p.bio || p.summary}</p>
            <ul className="flex flex-wrap gap-2">
              <Chip icon={MapPin} label="Location">
                {p.city}, <span className="font-mono">{p.state}</span>
              </Chip>
              <Chip icon={DollarSign} label="Price per visit">
                <span className="font-mono">{p.priceUsd}</span>
                <span className="text-muted-foreground">a visit</span>
              </Chip>
              <Chip icon={Clock} label="Visit length">
                <span className="font-mono">{p.sessionMinutes}</span> min
              </Chip>
              {p.visitModes.map((m) => {
                const Icon = visitModeIcon[m];
                return (
                  <Chip key={m} icon={Icon} label="Visits">
                    {visitModeLabel[m]}
                  </Chip>
                );
              })}
              <Chip icon={Languages} label="Languages">
                {p.languages.join(", ")}
              </Chip>
            </ul>
          </SoftCard>
        </Rise>

        <Rise as="section" i={2} aria-labelledby="times-heading" className="@container flex min-w-0 flex-col gap-4">
          {mine.length > 0 && !move && (
            <div>
              <h2 className="text-title font-semibold">Booked with {p.name}</h2>
              <YourVisits memberId={memberId} bookings={mine} partnerName={partnerName} now={now} showProvider={false} className="mt-3" />
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 id="times-heading" className="text-title font-semibold">
              {move ? `Move your visit on ${formatWeekday(move.startsAt)} ${formatMonth(move.startsAt)} ${formatDayNumber(move.startsAt)}, ${formatClock(move.startsAt)}` : "Open times, next two weeks"}
            </h2>
            <ul>
              <NextOpening first={open[0]} now={now} />
            </ul>
          </div>
          {slots.data ? (
            <SlotPicker key={move?.id ?? "new"} memberId={memberId} providerName={p.name} slots={open} partnerName={partnerName} defaultVisibility={defaultVisibility} move={move} />
          ) : (
            <p role="status" className="text-label text-muted-foreground">
              Open times did not load. Try again in a moment.
            </p>
          )}
        </Rise>
      </div>
    </PageFrame>
  );
}

function ProviderFallback() {
  return (
    <main className="grid gap-6 px-4 pt-16 md:grid-cols-[2fr_3fr] md:px-8" aria-busy>
      <div className="h-80 animate-pulse rounded-3xl bg-muted" />
      <div className="h-96 animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
