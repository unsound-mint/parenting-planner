import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyContext } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/product";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { FamilyNav } from "@/components/shell/family-nav";
import { RoleSwitch } from "@/components/shell/role-switch";
import { UrgentHelpLink } from "@/components/shell/urgent-help-link";

// Frame for every family screen: navigation, the role switch and the urgent
// help entry, which must stay visible on every screen (docs/design.md, rule 5).
export default function FamilyLayout({ children, params }: LayoutProps<"/family/[memberId]">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401 || !family) redirect("/");
  const people = familyPeople(family);
  const person = people.find((p) => p.id === memberId);
  if (!person) notFound();
  // The Plan entry shows only once tasks work: the API answers 501 until then.
  const hasPlan = !isCaregiver(person.role) && (await api.GET("/members/{memberId}/tasks", { params: { path: { memberId } } })).response.ok;

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-56 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between gap-3 md:block">
          <p className="px-2 text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
          <div className="md:hidden">
            <UrgentHelpLink />
          </div>
        </div>
        <FamilyNav memberId={memberId} role={person.role} hasPlan={hasPlan} />
        <div className="mt-auto hidden rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground md:block">
          <p className="font-medium text-foreground">Demo family</p>
          <p>Synthetic data, your own copy. Changes stay in this browser session.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 md:px-8 md:pt-5">
          <RoleSwitch people={people} memberId={memberId} />
          <span className="order-3 hidden flex-1 md:block" />
          <span className="order-4 inline-flex h-6 items-center rounded-full bg-status-due-soft px-2.5 text-caption font-medium text-status-due">
            Demo data
          </span>
          <Link href="/pricing" className="order-4 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground">
            {family.tier === "free" ? "Plans" : `${family.tier === "plus" ? "Plus" : "Concierge"} plan`}
          </Link>
          <span className="order-4 hidden text-label font-normal text-muted-foreground sm:inline">{familyContext(family)}</span>
          <div className="order-5 hidden md:block">
            <UrgentHelpLink />
          </div>
        </header>
        <ViewTransition>{children}</ViewTransition>
      </div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-56 border-r border-border bg-card md:block" />
      <p className="p-10 text-muted-foreground">Opening your family...</p>
    </div>
  );
}
