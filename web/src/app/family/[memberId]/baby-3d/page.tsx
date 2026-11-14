import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { inLossSupport } from "@/lib/loss";
import { PageFrame } from "@/components/shell/page";
import { Baby3DView } from "@/components/baby-3d/view";

// The baby in soft 3D, week by week, with what develops when. Opened from the
// This week hero (See3DLink). Only for a pregnancy; everyone else, and a family
// in pregnancy loss support, lands on their home screen.
export default function Baby3DPage({ params, searchParams }: PageProps<"/family/[memberId]/baby-3d">) {
  return (
    <Suspense fallback={<Baby3DFallback />}>
      <Baby3D params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Baby3D({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<{ week?: string | string[] }> }) {
  const [{ memberId }, { week: weekParam }] = await Promise.all([params, searchParams]);
  await requireParent(memberId);
  const home = `/family/${memberId}`;
  const api = await serverApi();
  const [{ data: family }, { data: growth }] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/pregnancy-growth", { params: { path: { memberId } } }),
  ]);
  if (!family || family.stage !== "pregnancy" || inLossSupport(family) || !growth) redirect(home);
  const asked = Number(Array.isArray(weekParam) ? weekParam[0] : weekParam);
  const week = Number.isFinite(asked) && asked >= 4 && asked <= 40 ? Math.round(asked) : growth.currentWeek;

  return (
    <PageFrame className="gap-4">
      <header>
        <Link
          href={home}
          className="-ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-full px-2 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          This week
        </Link>
      </header>
      <Baby3DView growth={growth} initialWeek={week} />
    </PageFrame>
  );
}

function Baby3DFallback() {
  return (
    <PageFrame aria-busy>
      <div className="h-11" />
      <div className="h-9 w-72 rounded-lg bg-muted" />
      <div className="h-[min(64vh,760px)] min-h-[340px] rounded-3xl bg-[#FCEBD5]" />
    </PageFrame>
  );
}
