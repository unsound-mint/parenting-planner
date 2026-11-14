import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Lock, TimerOff, Ban, UserCheck, type LucideIcon } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import type { InvitationStatus } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/product";
import { cn } from "@/lib/utils";
import { permissionIcon, permissionLabel, roleAccent, roleIcon, roleLabel } from "@/lib/visuals";
import { PREVIEW_INVITE_TOKEN, previewInvitation } from "@/lib/mock/fixtures/people";
import { previewMocksEnabled } from "@/lib/mock/registry";
import { AcceptInvitation } from "@/components/people/accept-invitation";

// Where an invitation link lands. No session is needed: the person is usually in
// another browser. Accepting creates the caregiver and starts their session.
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<InviteFallback />}>
      <Invite params={params} />
    </Suspense>
  );
}

const closed: Record<Exclude<InvitationStatus, "pending">, { icon: LucideIcon; title: string; text: string }> = {
  accepted: { icon: UserCheck, title: "This link was already used", text: "Each link opens once. Ask for a new one if you need to get back in." },
  revoked: { icon: Ban, title: "This invitation was withdrawn", text: "Ask the family for a new link." },
  expired: { icon: TimerOff, title: "This link has expired", text: "Links work for 7 days. Ask the family for a new one." },
};

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const api = await serverApi();
  let { data: invite } = await api.GET("/invitations/{token}", { params: { path: { token } } });
  // The token the People mock hands out is not stored anywhere, so a live API answers 404 for it.
  // Preview it from the same fixture; production never takes this branch.
  if (!invite && previewMocksEnabled && token === PREVIEW_INVITE_TOKEN) invite = previewInvitation();
  // Unknown token, or the endpoint is not live yet (501): there is no page.
  if (!invite) notFound();
  const Role = roleIcon[invite.role];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
      <div className="flex items-center gap-4">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full text-card", roleAccent[invite.role].bg)}>
          <Role aria-hidden className="size-7" />
        </span>
        <div>
          <h1 className="text-headline text-balance">{invite.invitedByName} invites you to help with the baby.</h1>
          <p className="mt-1 text-label font-normal text-muted-foreground">
            {invite.displayName}, as {roleLabel[invite.role].toLowerCase()}
          </p>
        </div>
      </div>

      {invite.status === "pending" ? (
        <>
          <section aria-labelledby="sees" className="rounded-2xl border border-border bg-card p-4">
            <h2 id="sees" className="text-title">
              You will see
            </h2>
            <ul className="mt-3 flex flex-col">
              {invite.permissions.map((p) => {
                const Icon = permissionIcon[p];
                return (
                  <li key={p} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
                      <Icon aria-hidden className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1 text-label font-medium">{permissionLabel[p].name}</span>
                    <Check aria-hidden className="size-4 text-status-ok" />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-label text-muted-foreground">
              <Lock aria-hidden className="size-4 shrink-0" />
              The parents&apos; diaries, mood check-ins, labs and notes stay private.
            </p>
          </section>
          <AcceptInvitation token={token} />
          <p className="text-center font-mono text-caption text-muted-foreground">Open until {formatShortDate(invite.expiresAt)}</p>
        </>
      ) : (
        <ClosedInvite status={invite.status} />
      )}
    </main>
  );
}

function ClosedInvite({ status }: { status: Exclude<InvitationStatus, "pending"> }) {
  const c = closed[status];
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-due-soft text-status-due">
        <c.icon aria-hidden className="size-5" />
      </span>
      <div>
        <h2 className="text-title">{c.title}</h2>
        <p className="mt-1 text-body text-muted-foreground">{c.text}</p>
        <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-label font-medium text-primary underline-offset-4 hover:underline">
          Back to the start
        </Link>
      </div>
    </section>
  );
}

function InviteFallback() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10" aria-busy>
      <div className="h-14 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-48 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
