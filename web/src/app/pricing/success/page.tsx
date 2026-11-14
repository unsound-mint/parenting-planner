import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { PLANS } from "@/lib/plans";
import { tierIcon } from "@/lib/visuals";
import { PRODUCT_NAME } from "@/lib/product";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan unlocked" };

// Stripe sends the visitor here with ?session_id=. The API asks Stripe and
// applies the tier if the webhook has not arrived, so this never waits on it.
export default function SuccessPage({ searchParams }: PageProps<"/pricing/success">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-16 md:px-8">
      <span className="text-label font-semibold tracking-tight">{PRODUCT_NAME}</span>
      <div className="flex flex-1 flex-col justify-center py-12">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" aria-busy />}>
          <Result searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Result({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).session_id;
  const sessionId = typeof raw === "string" ? raw : undefined;
  let session;
  if (sessionId) {
    try {
      const api = await serverApi();
      const { data: family } = await api.GET("/family");
      const parent = family?.parents.find((p) => p.role === "mother") ?? family?.parents[0];
      if (parent) {
        session = (await api.GET("/members/{memberId}/checkout-sessions/{sessionId}", { params: { path: { memberId: parent.id, sessionId } } })).data;
      }
    } catch {
      session = undefined;
    }
  }

  if (!session || session.status !== "complete" || !session.paid) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-status-due-soft text-status-due">
          <CircleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-headline text-balance">The payment did not go through</h1>
        <p className="mt-2 text-body text-muted-foreground">Nothing was charged. You can pick a plan again.</p>
        <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-11 px-5 text-label")}>
          Back to plans
        </Link>
      </section>
    );
  }

  const plan = PLANS.find((p) => p.tier === session.tier);
  const Icon = tierIcon[session.tier];
  return (
    <section className="rounded-2xl border-2 border-primary bg-card p-8 shadow-lg shadow-primary/10">
      <span className="grid size-12 place-items-center rounded-full bg-status-ok-soft text-status-ok">
        <CircleCheck className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-headline text-balance">{plan?.name ?? "Your plan"} is on for both parents</h1>
      <p className="mt-2 flex items-center gap-2 text-body text-muted-foreground">
        <Icon className="size-4.5" aria-hidden />
        {plan?.tagline}
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {plan?.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-body">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-status-ok-soft text-status-ok">
              <CircleCheck className="size-3.5" aria-hidden />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link href="/family" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 w-full text-label")}>
        Back to your family
        <ArrowRight aria-hidden />
      </Link>
    </section>
  );
}
