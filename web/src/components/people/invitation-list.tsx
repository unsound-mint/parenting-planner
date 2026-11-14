"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hourglass, UserCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Caregiver, Invitation } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { permissionIcon, permissionLabel, roleAccent, roleLabel } from "@/lib/visuals";
import { Button } from "@/components/ui/button";

// Pending and active people. Revoking an accepted invitation also removes that
// person's access (revokeInvitation), so it asks twice.
export function InvitationList({ memberId, items, direct = [] }: { memberId: string; items: Invitation[]; direct?: Caregiver[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke(i: Invitation) {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/invitations/{invitationId}/revoke", {
        params: { path: { memberId, invitationId: i.id } },
      });
      setConfirming(null);
      if (error) {
        toast.error(error.message ?? "Could not revoke. Please try again.");
        return;
      }
      toast.success(i.status === "accepted" ? `${i.displayName} no longer has access.` : "Link revoked.");
      router.refresh();
    });
  }

  // Caregivers who are in the family without an invitation (the demo families): same row, removed by member.
  function removeDirect(c: Caregiver) {
    startTransition(async () => {
      const { error } = await api.POST("/members/{memberId}/caregivers/{caregiverId}/revoke", { params: { path: { memberId, caregiverId: c.id } } });
      setConfirming(null);
      if (error) {
        toast.error(error.message ?? "Could not remove. Please try again.");
        return;
      }
      toast.success(`${c.displayName} no longer has access.`);
      router.refresh();
    });
  }

  return (
    <ul className="flex flex-col">
      {direct.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-3 first:border-t-0 first:pt-0">
          <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-title font-semibold text-card", roleAccent[c.role].bg)}>
            {c.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-label font-semibold">
              {c.displayName}
              <span className="font-normal text-muted-foreground">{roleLabel[c.role]}</span>
            </p>
            <ul className="mt-1 flex gap-1.5" aria-label="Can see">
              {c.permissions.map((p) => {
                const Icon = permissionIcon[p];
                return (
                  <li key={p} title={permissionLabel[p].name} className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon aria-hidden className="size-3.5" />
                    <span className="sr-only">{permissionLabel[p].name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-status-ok-soft px-2 py-0.5 text-caption font-semibold text-status-ok">
            <UserCheck aria-hidden className="size-3" />
            Active
          </span>
          {confirming === c.id ? (
            <span className="flex items-center gap-1">
              <Button variant="destructive" className="h-11 px-3 md:h-9" disabled={pending} onClick={() => removeDirect(c)}>
                Remove access
              </Button>
              <Button variant="ghost" className="h-11 px-3 md:h-9" onClick={() => setConfirming(null)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="h-11 px-3 text-muted-foreground md:h-9" onClick={() => setConfirming(c.id)}>
              Remove
            </Button>
          )}
        </li>
      ))}
      {items.map((i) => {
        const active = i.status === "accepted";
        return (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-3 first:border-t-0 first:pt-0">
            <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-title font-semibold text-card", roleAccent[i.role].bg)}>
              {i.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-label font-semibold">
                {i.displayName}
                <span className="font-normal text-muted-foreground">{roleLabel[i.role]}</span>
              </p>
              <ul className="mt-1 flex gap-1.5" aria-label="Can see">
                {i.permissions.map((p) => {
                  const Icon = permissionIcon[p];
                  return (
                    <li key={p} title={permissionLabel[p].name} className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon aria-hidden className="size-3.5" />
                      <span className="sr-only">{permissionLabel[p].name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-semibold",
                active ? "bg-status-ok-soft text-status-ok" : "bg-status-due-soft text-status-due",
              )}
            >
              {active ? <UserCheck aria-hidden className="size-3" /> : <Hourglass aria-hidden className="size-3" />}
              {active ? "Active" : `Waiting, until ${formatShortDate(i.expiresAt)}`}
            </span>
            {confirming === i.id ? (
              <span className="flex items-center gap-1">
                <Button variant="destructive" className="h-11 px-3 md:h-9" disabled={pending} onClick={() => revoke(i)}>
                  {active ? "Remove access" : "Revoke link"}
                </Button>
                <Button variant="ghost" className="h-11 px-3 md:h-9" onClick={() => setConfirming(null)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="h-11 px-3 text-muted-foreground md:h-9" onClick={() => setConfirming(i.id)}>
                {active ? "Remove" : "Revoke"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
