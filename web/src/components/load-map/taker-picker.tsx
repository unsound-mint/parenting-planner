"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/joy/partner-chip";
import { api } from "@/lib/api/client";
import type { Person } from "@/lib/roles";
import { roleLabel } from "@/lib/visuals";

/**
 * Who can take the work: the family members the API lists as takers (the other
 * parent, and a grandparent or nanny who may use the plan). One button each,
 * with their colour and role, so the choice reads as people, not a dropdown.
 */
export function TakerPicker({ takers, others = [], memberId, label, disabled, onPick }: { takers: Person[]; others?: Person[]; memberId: string; label: string; disabled?: boolean; onPick: (to: Person) => void }) {
  const router = useRouter();
  const [enabling, setEnabling] = useState<string | null>(null);

  // A grandparent or nanny without the shared to-do list cannot take tasks. Turning it on
  // here (the same switch as on the Privacy page) and offering in one step saves a detour.
  async function enableAndOffer(p: Person) {
    setEnabling(p.id);
    // Read their current list first so turning this one on keeps everything else they have.
    const fam = await api.GET("/family");
    const current = fam.data?.caregivers.find((c) => c.id === p.id)?.permissions ?? [];
    const { error } = fam.error
      ? fam
      : await api.PATCH("/members/{memberId}/caregivers/{caregiverId}", {
          params: { path: { memberId, caregiverId: p.id } },
          body: { permissions: [...current.filter((x) => x !== "family_plan"), "family_plan"] },
        });
    setEnabling(null);
    if (error) {
      toast.error(error.message ?? "Could not turn on the shared to-do list. Nothing changed.");
      return;
    }
    router.refresh();
    onPick(p);
  }

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-label font-medium text-ink-2">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {takers.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(p)}
              className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-line-2 bg-card py-1 pr-4 pl-1.5 text-label transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              <Avatar person={p} />
              <span className="font-medium">{p.displayName}</span>
              <span className="text-caption text-muted-foreground">{roleLabel[p.role]}</span>
            </button>
          </li>
        ))}
      </ul>
      {takers.length === 0 && others.length === 0 && <p className="text-label font-normal text-muted-foreground">Nobody else is here yet. Invite someone below and turn on the shared to-do list for them.</p>}
      {others.length > 0 && (
        <ul className="flex flex-col gap-1 text-caption text-muted-foreground">
          {others.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-2">
              <Avatar person={p} size="sm" className="opacity-60" />
              <span className="min-w-0 flex-1">{p.displayName} does not see the shared to-do list yet.</span>
              <button
                type="button"
                disabled={disabled || enabling !== null}
                onClick={() => enableAndOffer(p)}
                className="press min-h-9 rounded-full px-2 text-ink underline decoration-line-2 underline-offset-3 hover:decoration-ink disabled:opacity-50"
              >
                {enabling === p.id ? "Turning it on…" : `Share it and offer to ${p.displayName}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
