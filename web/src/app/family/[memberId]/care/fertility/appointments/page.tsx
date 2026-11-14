import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { planningContext } from "@/lib/fertility-gate";
import { familyNow } from "@/lib/clock";
import { isoDay } from "@/lib/fertility";
import { formatShortDate } from "@/lib/format";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { AppointmentQuestions } from "@/components/week/appointment-questions";
import { FertilityTabs } from "@/components/fertility/fertility-tabs";
import { NotesCard } from "@/components/fertility/notes-card";

// The fertility appointment organizer: the next visit (the existing appointments and
// appointment-questions APIs), the questions for it, and tests and clinic notes.
export default function FertilityAppointmentsPage({ params }: PageProps<"/family/[memberId]/care/fertility/appointments">) {
  return (
    <Suspense fallback={<main className="px-4 pt-6 md:px-8" aria-busy><div className="h-72 animate-pulse rounded-3xl bg-muted" /></main>}>
      <Appointments params={params} />
    </Suspense>
  );
}

async function Appointments({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { api, family, partner } = await planningContext(memberId);
  const path = { params: { path: { memberId } } };
  const [{ data: questions }, { data: list }] = await Promise.all([api.GET("/members/{memberId}/appointment-questions", path), api.GET("/members/{memberId}/fertility-entries", path)]);
  const today = isoDay(familyNow(family));
  const next = questions?.appointments[0];
  return (
    <PageFrame>
      <Rise i={0}>
        <FertilityTabs memberId={memberId} />
      </Rise>
      <Rise i={1}>
        <SoftCard tone="leaf" hero>
          {next ? (
            <Link href={`/family/${memberId}/appointments/${next.id}`} className="press group flex items-center gap-4 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card">
                <CalendarClock className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline text-balance">{next.title}</span>
                <span className="mt-1 block font-mono text-caption text-muted-foreground">{formatShortDate(next.startsAt.slice(0, 10))}. Open the prep view.</span>
              </span>
              <ChevronRight className="size-5 shrink-0 transition-transform duration-(--duration-base) ease-out group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <h1 className="text-headline text-balance">No visit booked yet. Write your questions down and they wait for it.</h1>
          )}
        </SoftCard>
      </Rise>
      <PageGrid>
        <Rise i={2}>
          <Suspense>
            <AppointmentQuestions memberId={memberId} partnerName={partner?.displayName} />
          </Suspense>
        </Rise>
        <Stack>
          <Rise i={3}>
            <NotesCard memberId={memberId} today={today} mine={memberId} partnerName={partner?.displayName} entries={list?.items ?? []} />
          </Rise>
        </Stack>
      </PageGrid>
    </PageFrame>
  );
}
