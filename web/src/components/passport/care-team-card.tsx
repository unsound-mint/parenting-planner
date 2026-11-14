"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { CareRole, CareTeamMember, PassportPerson } from "@/lib/api/types";
import { careRoleIcon, careRoleLabel, passportIcon } from "@/lib/visuals";
import { Input } from "@/components/ui/input";
import { AddButton, EditButton, EditorForm, Field, fieldClass, useSave } from "./edit-kit";
import { SectionCard } from "./section-card";

type Draft = { name: string; role: CareRole; clinic: string; phone: string };

const bodyOf = (d: Draft) => ({ name: d.name.trim(), role: d.role, clinic: d.clinic.trim() || undefined, phone: d.phone.trim() || undefined });

// The doctors and clinicians who look after this person: who, what they do,
// where, and a phone link. A family pediatrician is shared by all children,
// so editing it on one child's passport changes it for each of them.
export function CareTeamCard({ person, memberId }: { person: PassportPerson; memberId: string }) {
  const editable = person.isActingParent || person.kind === "child";
  const childId = person.kind === "child" ? person.id : undefined;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const defaultRole: CareRole = person.kind === "child" ? "pediatrician" : person.role === "mother" ? "obstetrician" : "primary_care";

  return (
    <SectionCard
      id="care-team-title"
      icon={passportIcon.careTeam}
      title="Care team"
      figure={editable && !adding && <AddButton label="Add" onClick={() => setAdding(true)} />}
    >
      {adding && <CareEditor memberId={memberId} childId={childId} defaultRole={defaultRole} onClose={() => setAdding(false)} className="mb-4" />}
      {person.careTeam.length === 0
        ? !adding && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-label text-muted-foreground">No doctors or clinics added yet.</p>
        : (
          <ul className="flex flex-col divide-y divide-border">
            {person.careTeam.map((m) => {
              const Icon = careRoleIcon[m.role];
              return (
                <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                  {editing === m.id ? (
                    <CareEditor memberId={memberId} member={m} defaultRole={m.role} onClose={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-up-soft text-status-up">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium break-words">{m.name}</p>
                        <p className="text-label font-normal text-muted-foreground break-words">{[careRoleLabel[m.role], m.clinic].filter(Boolean).join(" · ")}</p>
                        {m.phone && (
                          <a
                            href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}
                            className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full font-mono text-caption text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <Phone className="size-3.5" aria-hidden />
                            {m.phone}
                          </a>
                        )}
                      </div>
                      {editable && <EditButton label={`Edit ${m.name}`} onClick={() => setEditing(m.id)} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </SectionCard>
  );
}

function CareEditor({
  memberId,
  childId,
  member,
  defaultRole,
  onClose,
  className,
}: {
  memberId: string;
  childId?: string;
  member?: CareTeamMember;
  defaultRole: CareRole;
  onClose: () => void;
  className?: string;
}) {
  const [d, setD] = useState<Draft>(
    member ? { name: member.name, role: member.role, clinic: member.clinic, phone: member.phone ?? "" } : { name: "", role: defaultRole, clinic: "", phone: "" },
  );
  const save = useSave();
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  function submit() {
    if (!d.name.trim()) return void toast.error("Add their name.");
    if (member) {
      save.run(
        () => api.PUT("/members/{memberId}/care-team/{careTeamId}", { params: { path: { memberId, careTeamId: member.id } }, body: bodyOf(d) }),
        "Could not save.",
        onClose,
      );
    } else {
      save.run(() => api.POST("/members/{memberId}/care-team", { params: { path: { memberId } }, body: { childId, ...bodyOf(d) } }), "Could not add them.", onClose);
    }
  }

  function remove() {
    if (!member) return;
    save.run(() => api.DELETE("/members/{memberId}/care-team/{careTeamId}", { params: { path: { memberId, careTeamId: member.id } } }), "Could not remove them.", onClose);
  }

  return (
    <EditorForm title={member ? `Edit ${member.name}` : "Add to the care team"} pending={save.pending} onSubmit={submit} onCancel={onClose} onDelete={member && remove} className={className}>
      <Field label="Name">
        <Input className={fieldClass} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Dr. Maya Reyes" maxLength={80} required />
      </Field>
      <Field label="Role">
        <select className={fieldClass} value={d.role} onChange={(e) => set({ role: e.target.value as CareRole })}>
          {(Object.keys(careRoleLabel) as CareRole[]).map((r) => (
            <option key={r} value={r}>
              {careRoleLabel[r]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Clinic (optional)">
        <Input className={fieldClass} value={d.clinic} onChange={(e) => set({ clinic: e.target.value })} placeholder="Riverside Women's Health" maxLength={120} />
      </Field>
      <Field label="Phone (optional)">
        <Input type="tel" className={fieldClass} value={d.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(555) 014-2290" maxLength={40} />
      </Field>
    </EditorForm>
  );
}
