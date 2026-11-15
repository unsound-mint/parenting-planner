import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyContext } from "@/lib/format";
import { inLossSupport } from "@/lib/loss";
import { hasOlderChild, isPlanning } from "@/lib/stage";
import { PRODUCT_NAME } from "@/lib/product";
import { familyPeople, isCaregiver, unavailableScreens } from "@/lib/roles";
import { ResetDemo } from "@/components/shell/reset-demo";
import { DemoMenu } from "@/components/shell/demo-menu";
import { DemoClock } from "@/components/shell/demo-clock";
import { NotificationBell } from "@/components/shell/notification-bell";
import { LiveUpdates } from "@/components/shell/live-updates";
import { FamilyNav, FamilyTabBar } from "@/components/shell/family-nav";
import { RoleSwitch } from "@/components/shell/role-switch";
import { UrgentHelpLink } from "@/components/shell/urgent-help-link";
import { FamilyClockProvider } from "@/components/shell/family-clock";
import { SiteFooter } from "@/components/shell/site-footer";

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
  // An invited caregiver's session acts only as that caregiver and cannot manage the family
  // (the API answers 404 for other people and 403 for demo time, upgrades and admin).
  const boundTo = family.sessionMemberId;
  if (boundTo && boundTo !== memberId) redirect(`/family/${boundTo}`);
  const people = familyPeople(family);
  const person = people.find((p) => p.id === memberId);
  // An address from another family (an old tab after the visitor started a new demo
  // or their own family) opens the current family instead of a 404.
  if (!person) redirect("/family");

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
    // The practice rounds are first-night-home scenarios: nothing for a family that is planning or has a child past toddler age.
    simulator: inLossSupport(family) || isPlanning(family) || hasOlderChild(family) ? 404 : simulator.response.status,
    // Stage lessons give way to the support card in loss support (the page does the same),
    // and so does the baby budget: no money planning while a family grieves.
    ...(inLossSupport(family) ? { learn: 404, money: 404 } : {}),
    ...(care || family.children.length === 0 ? { baby: care?.response.status ?? 404 } : {}),
    ...(invitations ? { people: invitations.response.status } : {}),
  });

  const navProps = { memberId, role: person.role, hidden, childName: hasOlderChild(family) ? family.children[0]?.name : undefined };
  const context = familyContext(family);
  // "Week 25 of pregnancy · due Feb 27": the first phrase leads, the rest is quieter.
  const cut = context.search(/ of |, /);

  return (
    // data-acting swaps the --me / --them accent for the whole document (globals.css).
    <div data-acting={person.role} className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <aside className="print:hidden sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line px-4 pt-6 pb-4 md:flex">
        <p className="flex items-center gap-2.5 px-2.5 font-heading text-[1.0625rem] font-semibold whitespace-nowrap [font-variation-settings:'SOFT'_100]">
          <BrandMark />
          {PRODUCT_NAME}
        </p>
        <FamilyNav {...navProps} />
        <div className="mt-auto rounded-2xl bg-muted px-3.5 py-3 text-label font-normal text-muted-foreground">
          <p className="font-semibold text-ink">Demo family</p>
          <p>Synthetic data. Your own copy, kept in this browser session.</p>
          {!boundTo && (
            <Link href="/admin" className="mt-1.5 inline-block underline underline-offset-2 hover:text-foreground">
              Demo admin
            </Link>
          )}
        </div>
      </aside>

      {/* One width cap for the header and the page, so their edges line up, and the container
          that PageGrid's columns query (docs/design.md, Layout). The phone padding keeps the end of every page clear of the tab bar. */}
      <div className="@container flex w-full min-w-0 max-w-page flex-1 flex-col max-md:pb-20">
        <header className="print:hidden flex flex-wrap items-center gap-x-2 gap-y-2 px-4 md:gap-x-3 pt-3 md:min-h-21 md:px-8 md:pt-0">
          <RoleSwitch people={boundTo ? people.filter((p) => p.id === boundTo) : people} memberId={memberId} />
          {context && (
            <span className="order-3 hidden text-label font-normal text-muted-foreground lg:inline">
              {cut > 0 ? (
                <>
                  <b className="font-semibold text-ink">{context.slice(0, cut)}</b>
                  {context.slice(cut)}
                </>
              ) : (
                <b className="font-semibold text-ink">{context}</b>
              )}
            </span>
          )}
          <span className="order-3 hidden flex-1 md:block" />
          {!boundTo && (
            <>
              <DemoClock memberId={memberId} daysAhead={family.demoDaysAhead ?? 0} className="max-md:hidden" />
              <DemoMenu
                memberId={memberId}
                daysAhead={family.demoDaysAhead ?? 0}
                upgrade={family.tier === "free"}
                planLabel={`${family.tier === "plus" ? "Plus" : "Concierge"} plan`}
              />
              <Link href="/pricing" className="order-4 text-label max-[1399px]:hidden text-muted-foreground transition-colors duration-150 hover:text-foreground">
                {family.tier === "free" ? "Upgrade" : `${family.tier === "plus" ? "Plus" : "Concierge"} plan`}
              </Link>
              <ResetDemo className="max-md:hidden" />
            </>
          )}
          {notifications.data && (
            <div className="order-5">
              <NotificationBell memberId={memberId} role={person.role} initial={notifications.data} />
            </div>
          )}
          <div className="order-6">
            <UrgentHelpLink memberId={memberId} />
          </div>
        </header>
        <LiveUpdates memberId={memberId} />
        <FamilyClockProvider daysAhead={family.demoDaysAhead ?? 0}>
          <ViewTransition>{children}</ViewTransition>
        </FamilyClockProvider>
        <SiteFooter memberId={memberId} className="mx-4 mt-auto mb-6 md:mx-8" />
      </div>
      <FamilyTabBar {...navProps} />
    </div>
  );
}

/** A small sun over a hill: the product mark beside the name. */
function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden className="shrink-0">
      <circle cx="15" cy="15" r="14" className="fill-sun" />
      <path d="M8 18c2-6 12-6 14 0" className="stroke-me" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="15" cy="10" r="3" className="fill-leaf" />
    </svg>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden print:hidden w-62 border-r border-line md:block" />
      <p className="p-10 text-muted-foreground">Opening your family...</p>
    </div>
  );
}
