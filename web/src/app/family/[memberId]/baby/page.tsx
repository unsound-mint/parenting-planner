import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { BabyHome } from "@/components/baby/baby-home";

// "Baby": the same care screen a nanny gets as her home, for the parents. They
// log feeds, sleeps and diapers here and start the handoff the nanny accepts.
export default function BabyPage({ params }: PageProps<"/family/[memberId]/baby">) {
  return (
    <Suspense fallback={<BabyFallback />}>
      <Baby params={params} />
    </Suspense>
  );
}

async function Baby({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  if (!family) notFound();
  return <BabyHome memberId={memberId} family={family} />;
}

function BabyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-32 max-w-2xl animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
