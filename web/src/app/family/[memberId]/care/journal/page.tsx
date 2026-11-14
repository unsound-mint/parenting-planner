import { Suspense } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { Journal } from "@/components/wellbeing/journal";
import { PageFrame } from "@/components/shell/page";
import { BackToCare, Unavailable, WellbeingFallback } from "@/components/wellbeing/chrome";

// The private journal: own entries plus whatever the partner shared. Parents only.
export default function JournalPage({ params }: PageProps<"/family/[memberId]/care/journal">) {
  return (
    <Suspense fallback={<WellbeingFallback />}>
      <Page params={params} />
    </Suspense>
  );
}

async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, { data: entries }, { data: moods }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/diary-entries", path),
    api.GET("/members/{memberId}/mood-checkins", path),
  ]);
  const me = family?.parents.find((p) => p.id === memberId);
  if (!family || !me) notFound();
  const partner = family.parents.find((p) => p.id !== memberId);

  return (
    <PageFrame className="block pt-4">
      <BackToCare memberId={memberId} />
      {!entries ? (
        <Unavailable title="Your journal is not loading" />
      ) : (
        <Journal
          memberId={memberId}
          partner={partner ? { id: partner.id, name: partner.displayName } : undefined}
          entries={entries.items}
          moods={(moods?.items ?? []).filter((m) => m.authorId === memberId)}
        />
      )}
    </PageFrame>
  );
}
