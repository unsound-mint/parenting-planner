import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { countWord, familyContext } from "@/lib/format";
import { familyPeople } from "@/lib/roles";
import { AccessLog } from "@/components/people/access-log";
import { InvitationList } from "@/components/people/invitation-list";
import { InviteForm } from "@/components/people/invite-form";
import { LoadMapEmpty } from "@/components/load-map/load-map-empty";
import { LoadMapCard } from "@/components/load-map/load-map-card";
import { ThanksSection } from "@/components/thanks/thanks-section";
import { Rise } from "@/components/joy/rise";
import { PageFrame } from "@/components/shell/page";

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
  const [{ data: family }, invitations, log, loadMap, thanks, suggestions] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/invitations", path),
    api.GET("/members/{memberId}/access-log", path),
    api.GET("/members/{memberId}/load-map", path),
    api.GET("/members/{memberId}/thanks", path),
    api.GET("/members/{memberId}/thanks/suggestions", path),
  ]);
  const people = familyPeople(family ?? { parents: [] });
  if (invitations.response.status === 401) redirect("/");
  // 501: the screen does not exist yet (the nav entry is hidden too).
  if (!family || !invitations.data) notFound();

  const shown = invitations.data.items.filter((i) => i.status === "pending" || i.status === "accepted");
  const waiting = shown.filter((i) => i.status === "pending").length;
  // Who helps is who is in the family (seeded or joined by a link), not only who was invited.
  const helpers = (family.caregivers ?? []).map((c) => c.displayName.trim()).filter(Boolean);
  const helperCount = family.caregivers?.length ?? 0;
  const child = family.children[0]?.name ?? "the baby";
  const helping = helperCount > 0 ? `${helperCount <= 3 && helpers.length === helperCount ? joinNames(helpers) : `${countWord(helperCount)} people`} ${helperCount === 1 ? "helps" : "help"} with ${child}.` : undefined;
  const waitingLine = waiting > 0 ? `${countWord(waiting)} ${waiting === 1 ? "invitation is" : "invitations are"} waiting to be opened.` : undefined;
  const headline = [helping, waitingLine].filter(Boolean).join(" ") || "Nobody else helps yet. Invite someone with a link.";

  const invitedIds = new Set(shown.map((i) => i.memberId).filter(Boolean));
  const direct = (family.caregivers ?? []).filter((c) => !invitedIds.has(c.id));
  const couple = loadMap.data;
  const hasThanks = !!(thanks.data && suggestions.data);
  return (
    <PageFrame>
      <header>
        <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
        <p className="mt-2 text-label font-normal text-muted-foreground empty:hidden sm:hidden">{familyContext(family)}</p>
        {/* Privacy has no nav entry of its own: People is where it lives. */}
        <Link href={`/family/${memberId}/settings`} className="mt-2 inline-block text-label text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink">
          Privacy and your data
        </Link>
      </header>
      {/* Who carries what is the couple's own section and takes the full width once it has data. */}
      {couple && couple.areas.length > 0 && (
        <Rise i={1} className="min-w-0">
          <LoadMapCard memberId={memberId} initial={couple} people={people} />
        </Rise>
      )}
      {/* The rest are independent cards. CSS columns fill the width without holes whatever is
          present (no invitations yet, an empty log, no thanks endpoint); DOM order is the phone order. */}
      <div className="min-w-0 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid @4xl:columns-2 @7xl:columns-3">
        {couple && couple.areas.length === 0 && (
          <Rise i={1} className="min-w-0">
            <LoadMapEmpty memberId={memberId} />
          </Rise>
        )}
        {hasThanks && (
          <Rise i={2} className="min-w-0">
            <ThanksSection memberId={memberId} people={people} suggestions={suggestions.data!.items} thanks={thanks.data!.items} now={new Date()} />
          </Rise>
        )}
        <div className="min-w-0">
          <InviteForm memberId={memberId} family={family} />
        </div>
        {(shown.length > 0 || direct.length > 0) && (
          <section aria-labelledby="people-title" className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 id="people-title" className="mb-3 text-title">
              Who has access
            </h2>
            <InvitationList memberId={memberId} items={shown} direct={direct} />
          </section>
        )}
        {log.data && <AccessLog items={log.data.items} now={new Date()} />}
      </div>
    </PageFrame>
  );
}

function joinNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function PeopleFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 h-64 max-w-lg animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
