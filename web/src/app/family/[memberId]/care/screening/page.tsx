import { Suspense } from "react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { Screening } from "@/components/wellbeing/screening";
import { BackToCare, Unavailable, WellbeingFallback } from "@/components/wellbeing/chrome";

// Mood questionnaires (EPDS, PHQ-9). Screening, never a diagnosis. Parents only.
export default function ScreeningPage({ params }: PageProps<"/family/[memberId]/care/screening">) {
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
  const [{ data: questionnaires }, { data: past }] = await Promise.all([
    api.GET("/members/{memberId}/screening-questionnaires", path),
    api.GET("/members/{memberId}/mood-screenings", path),
  ]);

  return (
    <main className="flex-1 px-4 pt-4 pb-16 md:px-8">
      <BackToCare memberId={memberId} />
      {!questionnaires ? (
        <Unavailable title="The questionnaires are not loading" />
      ) : (
        <Screening
          memberId={memberId}
          questionnaires={questionnaires.items}
          past={(past?.items ?? []).filter((r) => r.authorId === memberId)}
        />
      )}
    </main>
  );
}
