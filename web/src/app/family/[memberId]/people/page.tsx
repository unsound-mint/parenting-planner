import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api/server";
import { requireParent } from "@/lib/guard";
import { countWord, familyContext } from "@/lib/format";
import { AccessLog } from "@/components/people/access-log";
import { InvitationList } from "@/components/people/invitation-list";
import { InviteForm } from "@/components/people/invite-form";

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
  const [{ data: family }, invitations, log] = await Promise.all([
    api.GET("/family"),
    api.GET("/members/{memberId}/invitations", path),
    api.GET("/members/{memberId}/access-log", path),
  ]);
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
    <main className="grid flex-1 content-start gap-8 px-4 pt-6 pb-16 md:px-8 xl:grid-cols-[minmax(0,32rem)_minmax(0,32rem)] xl:justify-start">
      <div className="flex min-w-0 flex-col gap-6">
        <header>
          <h1 className="max-w-2xl text-headline text-balance">{headline}</h1>
          <p className="mt-2 text-label font-normal text-muted-foreground empty:hidden sm:hidden">{familyContext(family)}</p>
        </header>
        <InviteForm memberId={memberId} />
      </div>
      <div className="flex min-w-0 flex-col gap-6 xl:pt-1">
        {shown.length > 0 && (
          <section aria-labelledby="people-title" className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <h2 id="people-title" className="mb-3 text-title">
              Who has access
            </h2>
            <InvitationList memberId={memberId} items={shown} />
          </section>
        )}
        {log.data && <AccessLog items={log.data.items} now={new Date()} />}
      </div>
    </main>
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
