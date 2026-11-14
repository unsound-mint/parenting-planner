import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ruler } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { getEssentialsOnly } from "@/lib/essentials";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { PageFrame, PageGrid, Stack } from "@/components/shell/page";
import { AddSupply, ShoppingList, SupplyCard } from "@/components/supplies/supply-list";

// Baby supplies: what is at home, what is running low, one shopping list both
// parents tick. Days left are an estimate from the care log, and say so.
export default function SuppliesPage({ params }: PageProps<"/family/[memberId]/baby/supplies">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Supplies params={params} />
    </Suspense>
  );
}

async function Supplies({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const [{ data: family }, { data: supplies }, essentialsOnly] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/supplies", { params: { path: { memberId } } }),
    getEssentialsOnly(memberId),
  ]);
  if (!family) notFound();
  if (!family.parents.some((p) => p.id === memberId)) redirect("/family");
  if (!supplies) notFound();

  const names = Object.fromEntries([...family.parents, ...family.caregivers].map((p) => [p.id, p.displayName]));
  const low = supplies.items.filter((i) => i.status !== "stocked");
  const first = low[0];
  const headline = first
    ? first.daysLeft !== undefined
      ? `${first.name} will run out in about ${first.daysLeft <= 0 ? "a day" : `${first.daysLeft} days`}.`
      : `${first.name} is ${first.status === "empty" ? "out" : "running low"}.`
    : "Everything is stocked.";
  const sizes = supplies.sizes;

  return (
    <PageFrame>
      <Rise as="header" i={0} className="flex flex-col gap-2">
        <Link href={`/family/${memberId}/baby`} className="inline-flex min-h-11 items-center gap-2 self-start text-label font-medium underline-offset-4 hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          Baby
        </Link>
        <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
        <p className="text-label font-normal text-muted-foreground">Days left are an estimate from the care log. Check the shelf before you rely on them.</p>
      </Rise>

      <PageGrid cols={3}>
        <Stack className="@7xl:col-span-2">
          <Rise i={1}>
            <AddSupply memberId={memberId} have={supplies.items.map((i) => i.name)} />
          </Rise>
          <div className="grid gap-4 @4xl:grid-cols-2">
            {supplies.items.map((item, n) => (
              <Rise key={item.id} i={Math.min(n + 2, 6)}>
                <SupplyCard memberId={memberId} item={item} essentialsOnly={essentialsOnly} />
              </Rise>
            ))}
          </div>
        </Stack>
        <Stack>
          <Rise i={2}>
            <ShoppingList memberId={memberId} items={supplies.shopping} names={names} />
          </Rise>
          {sizes && (
            <Rise i={3}>
              <SoftCard as="section" aria-labelledby="size-title" tone="leaf" className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Ruler aria-hidden className="size-5 text-leaf" />
                  <h2 id="size-title" className="text-title">
                    Sizes for {sizes.childName}
                  </h2>
                </div>
                <p className="text-body">
                  Clothes <span className="font-semibold">{sizes.clothing}</span>, diapers <span className="font-semibold">{sizes.diaper}</span>
                </p>
                <p className="font-mono text-caption text-muted-foreground">
                  Approximate · based on {sizes.basis === "weight" && sizes.weightLb ? `${sizes.weightLb.toFixed(1)} lb` : `${sizes.ageMonths} ${sizes.ageMonths === 1 ? "month" : "months"} old`}
                </p>
                <p className="text-caption text-muted-foreground">{sizes.note}</p>
              </SoftCard>
            </Rise>
          )}
        </Stack>
      </PageGrid>
    </PageFrame>
  );
}

function Fallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-48 max-w-2xl animate-pulse rounded-3xl bg-muted" />
    </main>
  );
}
