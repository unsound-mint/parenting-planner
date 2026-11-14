"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Phone, UserRound } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CareRole, CareTeamMember } from "@/lib/api/types";
import { familyPeople, isCaregiver } from "@/lib/roles";
import { careRoleIcon, careRoleLabel } from "@/lib/visuals";

// The family's own clinicians on the fixed help screen, below the national
// lines. Rules for this island:
// - Names and numbers come only from the family's records (passport), never
//   from AI. If anything fails or the device is offline with nothing saved,
//   it renders nothing: the national lines above always stand on their own.
// - Fetched once when /help opens, never from the family frame: passport reads
//   are audited, so a fetch per screen would flood the access log.
// - Only the clinicians you call when something is wrong with a pregnancy or a
//   baby. Never the psychologist: this screen can be open on a shared phone.
// - The last good list is kept in localStorage so it still shows offline.

type Contact = { id: string; name: string; label: string; forName?: string; detail?: string; phone?: string; role?: CareRole };
type Saved = { savedAt: string; contacts: Contact[] };

const URGENT_ROLES: readonly CareRole[] = ["obstetrician", "midwife", "pediatrician"];
const storageKey = (memberId: string) => `pp-help-care-team:${memberId}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromTeam(member: CareTeamMember, forName?: string): Contact {
  return { id: member.id, name: member.name, label: careRoleLabel[member.role], forName, detail: member.clinic || undefined, phone: member.phone, role: member.role };
}

async function load(memberId: string): Promise<Contact[] | null> {
  const { data: family } = await api.GET("/family");
  if (!family) return null;
  const me = familyPeople(family).find((p) => p.id === memberId);
  if (!me) return null;
  const path = { params: { path: { memberId } } };

  // A grandparent or nanny cannot read the passport; the baby card gives them
  // the pediatrician and the parents' emergency numbers.
  if (isCaregiver(me.role)) {
    const cards = await Promise.all(
      family.children.map((child) => api.GET("/members/{memberId}/children/{childId}/passport", { params: { path: { memberId, childId: child.id } } })),
    );
    const out: Contact[] = [];
    for (const { data } of cards) {
      if (!data) continue;
      if (data.pediatrician) out.push(fromTeam(data.pediatrician, data.child.name));
      data.emergencyContacts.forEach((c, n) => out.push({ id: `${data.child.id}-ec-${n}`, name: c.name, label: c.relation, phone: c.phone }));
    }
    return dedupe(out);
  }

  const { data: passport } = await api.GET("/members/{memberId}/passport", path);
  if (!passport) return null;
  const out: Contact[] = [];
  for (const person of passport.people) {
    for (const member of person.careTeam) {
      if (URGENT_ROLES.includes(member.role)) out.push(fromTeam(member, person.isActingParent ? undefined : person.name));
    }
  }
  return dedupe(out);
}

function dedupe(list: Contact[]): Contact[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.name}|${c.phone ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readSaved(memberId: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(memberId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** Digits only for tel:, keeping a leading 1 for US numbers written without it. */
function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits.length === 10 ? `1${digits}` : digits}`;
}

export function CareTeam() {
  const memberId = useSearchParams().get("m");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId || !UUID.test(memberId)) return;
    let live = true;
    const show = (list: Contact[], at: string | null) => {
      if (!live) return;
      setContacts(list);
      setSavedAt(at);
    };
    void (async () => {
      // The saved copy first, so it shows at once offline; the fresh list replaces it.
      const saved = readSaved(memberId);
      if (saved) show(saved.contacts, saved.savedAt);
      try {
        const fresh = await load(memberId);
        if (!fresh) return;
        show(fresh, null);
        localStorage.setItem(storageKey(memberId), JSON.stringify({ savedAt: new Date().toISOString(), contacts: fresh } satisfies Saved));
      } catch {
        // Offline, the API is down or storage is blocked: keep what is shown.
      }
    })();
    return () => {
      live = false;
    };
  }, [memberId]);

  if (!contacts || contacts.length === 0) return null;

  return (
    <section aria-labelledby="care-team" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="care-team" className="text-title font-semibold">
          Your care team
        </h2>
        <p className="font-mono text-caption text-muted-foreground">
          From your health passport
          {savedAt && `, saved ${new Date(savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {contacts.map((c) => {
          const Icon = c.role ? careRoleIcon[c.role] : UserRound;
          return (
            <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-body font-semibold break-words">{c.name}</p>
                  <p className="text-label text-muted-foreground break-words">
                    {c.label}
                    {c.forName && ` for ${c.forName}`}
                    {c.detail && `, ${c.detail}`}
                  </p>
                </div>
              </div>
              {c.phone ? (
                <a
                  href={telHref(c.phone)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-body font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Phone aria-hidden className="size-4" />
                  Call <span className="font-mono">{c.phone}</span>
                </a>
              ) : (
                <p className="text-label text-muted-foreground">No phone number saved.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
