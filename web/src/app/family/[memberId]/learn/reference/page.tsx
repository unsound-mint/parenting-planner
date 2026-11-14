import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { optional } from "@/components/today/slots";
import { requireParent } from "@/lib/guard";
import { PageFrame } from "@/components/shell/page";
import { helpHref } from "@/components/shell/urgent-help-link";
import { ReferenceBoard } from "@/components/reference/reference-board";

// Food and medicine reference for pregnancy and breastfeeding. Reference
// content, the same for every family; a medicine question can be saved to the
// parent's appointment list (private by default).
export default function ReferencePage({ params }: PageProps<"/family/[memberId]/learn/reference">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Reference params={params} />
    </Suspense>
  );
}

async function Reference({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [family, reference, questions] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/safety-reference", path),
    optional(api.GET("/members/{memberId}/appointment-questions", path)),
  ]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !reference.data) notFound();

  const asked = (questions?.items ?? []).filter((q) => q.authorId === memberId).map((q) => q.text);
  const breastfeeding = family.data.stage === "postpartum" || family.data.stage === "infant";
  return (
    <PageFrame className="gap-8">
      <ReferenceBoard memberId={memberId} entries={reference.data.items} asked={asked} initialMode={breastfeeding ? "breastfeeding" : "pregnancy"} helpHref={helpHref(memberId)} />
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-56 animate-pulse rounded-[2.25rem] bg-muted" />
      <div className="grid gap-4 @4xl:grid-cols-2 @7xl:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-44 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
