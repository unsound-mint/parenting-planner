import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyContext } from "@/lib/format";
import { inLossSupport } from "@/lib/loss";
import { PRODUCT_NAME } from "@/lib/product";
import { familyPeople, isCaregiver, unavailableScreens } from "@/lib/roles";
import { ResetDemo } from "@/components/shell/reset-demo";
import { DemoClock } from "@/components/shell/demo-clock";
import { NotificationBell } from "@/components/shell/notification-bell";
import { LiveUpdates } from "@/components/shell/live-updates";
import { FamilyNav } from "@/components/shell/family-nav";
import { RoleSwitch } from "@/components/shell/role-switch";
import { UrgentHelpLink } from "@/components/shell/urgent-help-link";
import { FamilyClockProvider } from "@/components/shell/family-clock";

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
  const path = { params: { path: { memberId } } };
  const [{ data: family, response }, calendar, simulator, notifications] = await Promise.all([
    api.GET("/family"),
    // Probes: a screen shows in the nav only once its endpoint works for this person.
    api.GET("/members/{memberId}/calendar-events", { params: { ...path.params, query: { scope: "mine" } } }),
    api.GET("/members/{memberId}/simulator", path),
    api.GET("/members/{memberId}/notifications", path),
  ]);
  if (response.status === 401 || !family) redirect("/");
  const people = familyPeople(family);
  const person = people.find((p) => p.id === memberId);
  if (!person) notFound();
  // The Plan entry shows only once tasks work: the API answers 501 until then.
  const hasPlan = !isCaregiver(person.role) && (await api.GET("/members/{memberId}/tasks", { params: { path: { memberId } } })).response.ok;

  // Parents only: a caregiver's nav has neither entry, and probing the care log as a caregiver would be an extra audited read.
  // Baby needs a child and a working care log; People needs the invitations endpoint.
  const [care, invitations] = isCaregiver(person.role)
    ? []
    : await Promise.all([
        family.children.length > 0 ? api.GET("/members/{memberId}/care-log", path) : undefined,
        api.GET("/members/{memberId}/invitations", path),
      ]);
  const hidden = unavailableScreens({
    calendar: calendar.response.status,
    // Newborn practice is baby prep: none of it while the family is in pregnancy loss support.
    simulator: inLossSupport(family) ? 404 : simulator.response.status,
    ...(care || family.children.length === 0 ? { baby: care?.response.status ?? 404 } : {}),
    ...(invitations ? { people: invitations.response.status } : {}),
  });

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <aside className="print:hidden flex shrink-0 flex-col gap-6 border-b border-border bg-card px-4 py-4 md:w-56 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between gap-3 md:block">
          <p className="px-2 text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
          <div className="md:hidden">
            <UrgentHelpLink />
          </div>
        </div>
        <FamilyNav memberId={memberId} role={person.role} hasPlan={hasPlan} hidden={hidden} />
        <div className="mt-auto hidden rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground md:block">
          <p className="font-medium text-foreground">Demo family</p>
          <p>Synthetic data, your own copy. Changes stay in this browser session.</p>
          <Link href="/admin" className="mt-1.5 inline-block underline underline-offset-2 hover:text-foreground">
            Demo admin
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 md:px-8 md:pt-5">
          <RoleSwitch people={people} memberId={memberId} />
          <span className="order-3 hidden flex-1 md:block" />
          <span className="order-4 inline-flex h-6 items-center rounded-full bg-status-due-soft px-2.5 text-caption font-medium text-status-due">
            Demo data
          </span>
          <ResetDemo />
          <DemoClock memberId={memberId} daysAhead={family.demoDaysAhead ?? 0} />
          <Link href="/pricing" className="order-4 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground">
            {family.tier === "free" ? "Upgrade" : `${family.tier === "plus" ? "Plus" : "Concierge"} plan`}
          </Link>
          <span className="order-4 hidden text-label font-normal text-muted-foreground sm:inline">{familyContext(family)}</span>
          {notifications.data && (
            <div className="order-5">
              <NotificationBell memberId={memberId} role={person.role} initial={notifications.data} />
            </div>
          )}
          <div className="order-5 hidden md:block">
            <UrgentHelpLink />
          </div>
        </header>
        <LiveUpdates memberId={memberId} />
        <FamilyClockProvider daysAhead={family.demoDaysAhead ?? 0}>
          <ViewTransition>{children}</ViewTransition>
        </FamilyClockProvider>
      </div>
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden print:hidden w-56 border-r border-border bg-card md:block" />
      <p className="p-10 text-muted-foreground">Opening your family...</p>
    </div>
  );
}
