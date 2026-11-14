import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { Card, CaregiverCard, FeedCard, NeverShared, PartnerCard, WaitingInvitations } from "@/components/settings/privacy-cards";
import { PermissionRow } from "@/components/people/permission-row";
import { PageFrame, PageGrid } from "@/components/shell/page";
import type { CaregiverPermission } from "@/lib/api/types";
import { ShieldCheck } from "lucide-react";

const allPermissions: CaregiverPermission[] = ["care_log", "baby_passport", "schedule", "family_plan", "pregnancy_updates"];

// Privacy for the person acting: who sees what, what is never shared, and the
// calendar link. A caregiver's switches save through the API; the rest reads
// the same endpoints as the screen it links to. Stage and notifications are in Settings.
export default function PrivacyPage({ params }: PageProps<"/family/[memberId]/privacy">) {
  return (
    <Suspense fallback={<PrivacyFallback />}>
      <Privacy params={params} />
    </Suspense>
  );
}

async function Privacy({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const api = await serverApi();
  const path = { params: { path: { memberId } } };
  const { data: family, response } = await api.GET("/family");
  if (response.status === 401) redirect("/");
  const me = family && familyPeople(family).find((p) => p.id === memberId);
  // A person from another family (an old tab after a new session): open the current family.
  if (family && !me) redirect("/family");
  if (!family || !me) notFound();
  const caregiver = isCaregiver(me.role);

  const [feed, invitations] = await Promise.all([
    api.GET("/members/{memberId}/calendar-feed", path),
    caregiver ? undefined : api.GET("/members/{memberId}/invitations", path),
  ]);

  const partner = family.parents.find((p) => p.id !== memberId);
  const waiting = invitations?.data?.items.filter((i) => i.status === "pending").length ?? 0;
  const mine = family.caregivers.find((c) => c.id === memberId);

  return (
    <PageFrame>
      <header>
        <h1 className="max-w-2xl text-headline text-balance">
          {caregiver ? "What you can see here." : "You decide who sees what."}
        </h1>
      </header>

      <PageGrid cols={3}>
        {caregiver ? (
          mine && (
            <Card title="You can see" icon={ShieldCheck}>
              <div className="flex flex-col">
                {allPermissions.map((p) => (
                  <PermissionRow key={p} permission={p} on={mine.permissions.includes(p)} />
                ))}
              </div>
              <p className="text-caption text-muted-foreground">A parent changes this.</p>
            </Card>
          )
        ) : (
          <>
            {partner && <PartnerCard partner={partner} />}
            {family.caregivers.map((c) => (
              <CaregiverCard key={c.id} memberId={memberId} caregiver={c} />
            ))}
          </>
        )}
        <NeverShared forCaregiver={caregiver} />
        {feed.data && <FeedCard memberId={memberId} feed={feed.data} />}
        {!caregiver && invitations?.data && <WaitingInvitations memberId={memberId} count={waiting} />}
      </PageGrid>
    </PageFrame>
  );
}

function PrivacyFallback() {
  return (
    <main className="px-4 pt-6 md:px-8" aria-busy>
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
