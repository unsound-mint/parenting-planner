import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { RoundPlayer } from "@/components/simulator/round-player";

// One round, on its own address so a reload picks up where the person stopped.
export default function RoundPage({ params }: PageProps<"/family/[memberId]/simulator/[roundId]">) {
  return (
    <Suspense fallback={<main className="px-4 pt-6 md:px-8" aria-busy><div className="h-64 max-w-2xl animate-pulse rounded-2xl bg-muted" /></main>}>
      <Round params={params} />
    </Suspense>
  );
}

async function Round({ params }: { params: Promise<{ memberId: string; roundId: string }> }) {
  const { memberId, roundId } = await params;
  const api = await serverApi();
  const [{ data: round }, calendar] = await Promise.all([
    api.GET("/members/{memberId}/simulator-rounds/{roundId}", { params: { path: { memberId, roundId } } }),
    // Link to the calendar after a commit only where the calendar works for this person.
    api.GET("/members/{memberId}/calendar-events", { params: { path: { memberId }, query: { scope: "mine" } } }),
  ]);
  if (!round) notFound();
  return <RoundPlayer memberId={memberId} initial={round} calendarOpen={calendar.response.ok} />;
}
