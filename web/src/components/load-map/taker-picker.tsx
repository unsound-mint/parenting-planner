"use client";

import Link from "next/link";
import { Avatar } from "@/components/joy/partner-chip";
import type { Person } from "@/lib/roles";
import { roleLabel } from "@/lib/visuals";

/**
 * Who can take the work: the family members the API lists as takers (the other
 * parent, and a grandparent or nanny who may use the plan). One button each,
 * with their colour and role, so the choice reads as people, not a dropdown.
 */
export function TakerPicker({ takers, others = [], memberId, label, disabled, onPick }: { takers: Person[]; others?: Person[]; memberId: string; label: string; disabled?: boolean; onPick: (to: Person) => void }) {
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
              <span>
                {p.displayName} can take tasks once the shared to-do list is on.{" "}
                <Link href={`/family/${memberId}/settings`} className="text-ink underline decoration-line-2 underline-offset-3 hover:decoration-ink">
                  Open sharing settings
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
