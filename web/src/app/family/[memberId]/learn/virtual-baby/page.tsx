import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";
import { VirtualBabyScreen } from "@/components/virtual-baby/screen";

// Virtual Baby, inside Learn: practise a simulated newborn together, one
// evening or the 48-hour challenge. Parents only (caregivers land on their
// home), and not shown in pregnancy loss support, like Learn itself.
export default function VirtualBabyPage({ params }: PageProps<"/family/[memberId]/learn/virtual-baby">) {
  return (
    <Suspense fallback={<Fallback />}>
      <VirtualBaby params={params} />
    </Suspense>
  );
}

async function VirtualBaby({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [family, vb] = await Promise.all([api.GET("/family"), api.GET("/members/{memberId}/virtual-baby", { params: { path: { memberId } } })]);
  if (family.response.status === 401) redirect("/");
  if (!family.data || !vb.data || inLossSupport(family.data)) notFound();

  return (
    <PageFrame className="gap-5">
      <Rise as="header" i={0}>
        <Link
          href={`/family/${memberId}/learn`}
          className="press inline-flex min-h-11 items-center gap-1.5 text-label text-ink-2 underline decoration-line-2 underline-offset-3 hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Learn together
        </Link>
      </Rise>
      <Rise i={1}>
        <VirtualBabyScreen key={memberId} memberId={memberId} parents={family.data.parents} initial={vb.data} />
      </Rise>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pt-6 md:px-8" aria-busy>
      <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="h-[32rem] animate-pulse rounded-[2.25rem] bg-muted" />
        <div className="hidden h-80 animate-pulse rounded-3xl bg-muted @5xl:block" />
      </div>
    </main>
  );
}
