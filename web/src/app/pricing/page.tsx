import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { PRODUCT_NAME } from "@/lib/product";
import { PlanCards } from "@/components/pricing/plan-cards";

export const metadata: Metadata = { title: "Plans" };

// Pricing works without the API: tiers are a constant (lib/plans.ts). The API
// only adds the family's current plan and an earlier upgrade request.
export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 md:px-8">
      <header className="flex items-center justify-between">
        <Link
          href="/family"
          className="inline-flex min-h-11 items-center gap-2 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4.5" aria-hidden />
          Back to your family
        </Link>
        <span className="text-label font-semibold tracking-tight">{PRODUCT_NAME}</span>
      </header>

      <div className="mx-auto mt-8 max-w-2xl text-center md:mt-12">
        <h1 className="text-headline text-balance">Pick the help that fits your family</h1>
        <p className="mt-3 text-body text-muted-foreground">Start free. Add a plan for both parents, or a person to call, when you want it.</p>
      </div>

      <div className="mt-12 md:mt-16">
        <Suspense fallback={<Cards />}>
          <Plans />
        </Suspense>
      </div>
    </main>
  );
}

async function Plans() {
  let family;
  try {
    const api = await serverApi();
    family = (await api.GET("/family")).data;
  } catch {
    family = undefined;
  }
  return <PlanCards currentTier={family?.tier} requested={family?.upgradeRequest} />;
}

function Cards() {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:gap-5" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-96 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
