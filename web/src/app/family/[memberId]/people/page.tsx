import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { countWord, familyContext } from "@/lib/format";
import { familyPeople } from "@/lib/roles";
import { AccessLog } from "@/components/people/access-log";
import { InvitationList } from "@/components/people/invitation-list";
import { InviteForm } from "@/components/people/invite-form";
import { LoadMapCard } from "@/components/load-map/load-map-card";
import { ThanksSection } from "@/components/thanks/thanks-section";
import { Rise } from "@/components/joy/rise";
import { PageFrame, PageGrid } from "@/components/shell/page";
import { MissionsLink } from "@/components/missions/missions-link";

// "People": invite a grandparent or nanny with a link, choose what they see,
// revoke, and read what they did. Parents only; the API refuses caregivers too.
export default function PeoplePage({ params }: PageProps<"/family/[memberId]/people">) {
  return (
    <Suspense fallback={<PeopleFallback />}>
      <People params={params} />
    </Suspense>
  );
}

async function People({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireParent(memberId);
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const [{ data: family }, invitations, log, loadMap, thanks, suggestions, missions] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/invitations", path),
    api.GET("/members/{memberId}/access-log", path),
    api.GET("/members/{memberId}/load-map", path),
    api.GET("/members/{memberId}/thanks", path),
    api.GET("/members/{memberId}/thanks/suggestions", path),
    api.GET("/members/{memberId}/missions", path),
  ]);
  const people = familyPeople(family ?? { parents: [] });
  if (invitations.response.status === 401) redirect("/");
  // 501: the screen does not exist yet (the nav entry is hidden too).
  if (!family || !invitations.data) notFound();

  const shown = invitations.data.items.filter((i) => i.status === "pending" || i.status === "accepted");
  const active = shown.filter((i) => i.status === "accepted").length;
  const waiting = shown.length - active;
  const headline =
    shown.length === 0
      ? "Nobody else helps yet. Invite someone with a link."
      : waiting === 0
        ? `${countWord(active)} ${active === 1 ? "person helps" : "people help"} with ${family.children[0]?.name ?? "the baby"}.`
        : `${countWord(waiting)} ${waiting === 1 ? "invitation is" : "invitations are"} waiting to be opened.`;

  return (
    <PageFrame>
      <header>
        <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
        <p className="mt-2 text-label font-normal text-muted-foreground empty:hidden sm:hidden">{familyContext(family)}</p>
      </header>
      {/* The couple's own section comes first: who carries what, and a way to say thanks.
          Either part is left out when its endpoint is not available. */}
      {(loadMap.data || (thanks.data && suggestions.data)) && (
        <PageGrid className="@4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @7xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {loadMap.data && (
            <Rise i={1} className="min-w-0">
              <LoadMapCard memberId={memberId} initial={loadMap.data} people={people} />
            </Rise>
          )}
          {thanks.data && suggestions.data && (
            <Rise i={2} className="min-w-0">
              <ThanksSection memberId={memberId} people={people} suggestions={suggestions.data.items} thanks={thanks.data.items} now={new Date()} />
            </Rise>
          )}
        </PageGrid>
      )}
      {missions.data && <MissionsLink memberId={memberId} missions={missions.data.items} />}
      {/* Two columns: the form on the left, access and the log stacked on the right (the last row
          is flexible so a tall form does not open a gap between them). Three columns at the widest. */}
      <PageGrid cols={3} className="@4xl:grid-rows-[auto_1fr] @7xl:grid-rows-none">
        <div className="min-w-0 @4xl:row-span-2 @7xl:row-span-1">
          <InviteForm memberId={memberId} family={family} />
        </div>
        {shown.length > 0 && (
          <section aria-labelledby="people-title" className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 id="people-title" className="mb-3 text-title">
              Who has access
            </h2>
            <InvitationList memberId={memberId} items={shown} />
          </section>
        )}
        {log.data && <AccessLog items={log.data.items} now={new Date()} />}
      </PageGrid>
    </PageFrame>
  );
}

function PeopleFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-64 max-w-lg animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
