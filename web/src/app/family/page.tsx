import { Suspense } from "react";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import type { Parent, PlanItem } from "@/lib/api/types";

// Placeholder screen: both parents' plans side by side, straight from the API.
// Frontend owns the real design.
export default function FamilyPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <Suspense fallback={<p>Loading family...</p>}>
        <Family />
      </Suspense>
    </main>
  );
}

async function Family() {
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401 || !family) redirect("/");

  return (
    <>
      <p className="mb-6 text-muted-foreground">
        Stage: {family.stage}
        {family.gestationalWeek != null && `, week ${family.gestationalWeek}`}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {family.parents.map((p) => (
          <ParentPlan key={p.id} parent={p} />
        ))}
      </div>
    </>
  );
}

async function ParentPlan({ parent }: { parent: Parent }) {
  const api = await serverApi();
  const { data: plan } = await api.GET("/members/{memberId}/plan", {
    params: { path: { memberId: parent.id } },
  });
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">{parent.role}</p>
      <h2 className="mb-4 text-2xl font-semibold">{parent.displayName}&apos;s week</h2>
      <ul className="flex flex-col gap-4">
        {plan?.items.map((it) => <Item key={it.ruleId} item={it} />)}
        {plan?.items.length === 0 && <li className="text-muted-foreground">Nothing due right now.</li>}
      </ul>
    </section>
  );
}

function Item({ item }: { item: PlanItem }) {
  return (
    <li>
      <p className="font-medium">
        {item.title} <span className="text-sm text-muted-foreground">({item.status}{item.dueBy && `, by ${item.dueBy}`})</span>
      </p>
      <p className="text-sm">{item.detail}</p>
      <p className="text-sm text-muted-foreground">Why: {item.reason}</p>
      <a className="text-sm underline" href={item.source.url} target="_blank" rel="noreferrer">
        {item.source.title}
      </a>
    </li>
  );
}
