"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Allergy, AllergyCertainty, PassportPerson, Visibility } from "@/lib/api/types";
import { allergyIcon, passportIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { AddButton, EditButton, EditorForm, Field, fieldClass, useSave, VisibilityField, VisibilityPicker } from "./edit-kit";
import { SectionCard } from "./section-card";

// What each certainty means, said in place under the allergy so the shield and
// the question mark never need a legend.
export const certaintyText: Record<AllergyCertainty, string> = {
  confirmed: "Confirmed by a doctor",
  suspected: "Suspected: noticed at home, not confirmed by a doctor yet",
};

type Draft = { substance: string; reaction: string; certainty: AllergyCertainty; visibility: Visibility };

const bodyOf = (d: Draft) => ({ substance: d.substance.trim(), reaction: d.reaction.trim() || undefined, certainty: d.certainty, visibility: d.visibility });

export function AllergiesCard({ person, memberId }: { person: PassportPerson; memberId: string }) {
  const editable = person.isActingParent || person.kind === "child";
  const showVisibility = person.isActingParent;
  const childId = person.kind === "child" ? person.id : undefined;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const save = useSave();
  const suspected = person.allergies.filter((a) => a.certainty === "suspected").length;

  function share(a: Allergy, visibility: Visibility) {
    save.run(
      () =>
        api.PUT("/members/{memberId}/allergies/{allergyId}", {
          params: { path: { memberId, allergyId: a.id } },
          body: bodyOf({ substance: a.substance, reaction: a.reaction ?? "", certainty: a.certainty, visibility }),
        }),
      "Could not change who can see it.",
    );
  }

  return (
    <SectionCard
      id="allergies-title"
      icon={passportIcon.allergies}
      title="Allergies"
      figure={editable && !adding && <AddButton label="Add" onClick={() => setAdding(true)} />}
    >
      {adding && <AllergyEditor memberId={memberId} childId={childId} showVisibility={showVisibility} onClose={() => setAdding(false)} className="mb-4" />}
      {person.allergies.length === 0
        ? !adding && (
            <p className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-status-ok-soft px-3 text-label font-medium text-status-ok">
              <ShieldCheck aria-hidden className="size-4" />
              No known allergies
            </p>
          )
        : (
          <ul className="flex flex-col divide-y divide-border">
            {person.allergies.map((a) => {
              const Icon = allergyIcon[a.certainty];
              const confirmed = a.certainty === "confirmed";
              return (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  {editing === a.id ? (
                    <AllergyEditor memberId={memberId} childId={childId} allergy={a} showVisibility={showVisibility} onClose={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          confirmed ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due",
                        )}
                      >
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium">
                          {a.substance}
                          {a.reaction && <span className="font-normal text-muted-foreground"> · {a.reaction}</span>}
                        </p>
                        <p className={cn("text-label font-normal", confirmed ? "text-muted-foreground" : "text-status-due")}>{certaintyText[a.certainty]}</p>
                        {showVisibility && (
                          <div className="mt-1.5">
                            <VisibilityPicker value={a.visibility} onChange={(v) => share(a, v)} disabled={save.pending} />
                          </div>
                        )}
                      </div>
                      {editable && <EditButton label={`Edit ${a.substance}`} onClick={() => setEditing(a.id)} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      {suspected > 0 && (
        <p className="mt-4 text-caption text-muted-foreground">
          Because a suspected allergy has not been tested, it is worth bringing up at the next visit. Once a doctor confirms it, change it to confirmed here.
        </p>
      )}
    </SectionCard>
  );
}

function AllergyEditor({
  memberId,
  childId,
  allergy,
  showVisibility,
  onClose,
  className,
}: {
  memberId: string;
  childId?: string;
  allergy?: Allergy;
  showVisibility: boolean;
  onClose: () => void;
  className?: string;
}) {
  const [d, setD] = useState<Draft>(
    allergy
      ? { substance: allergy.substance, reaction: allergy.reaction ?? "", certainty: allergy.certainty, visibility: allergy.visibility }
      : { substance: "", reaction: "", certainty: "suspected", visibility: childId ? "family" : "private" },
  );
  const save = useSave();
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  function submit() {
    if (!d.substance.trim()) return void toast.error("Add what it is an allergy to.");
    if (allergy) {
      save.run(
        () => api.PUT("/members/{memberId}/allergies/{allergyId}", { params: { path: { memberId, allergyId: allergy.id } }, body: bodyOf(d) }),
        "Could not save the allergy.",
        onClose,
      );
    } else {
      save.run(() => api.POST("/members/{memberId}/allergies", { params: { path: { memberId } }, body: { childId, ...bodyOf(d) } }), "Could not add the allergy.", onClose);
    }
  }

  function remove() {
    if (!allergy) return;
    save.run(() => api.DELETE("/members/{memberId}/allergies/{allergyId}", { params: { path: { memberId, allergyId: allergy.id } } }), "Could not remove the allergy.", onClose);
  }

  return (
    <EditorForm title={allergy ? `Edit ${allergy.substance}` : "Add an allergy"} pending={save.pending} onSubmit={submit} onCancel={onClose} onDelete={allergy && remove} className={className}>
      <Field label="Allergic to">
        <Input className={fieldClass} value={d.substance} onChange={(e) => set({ substance: e.target.value })} placeholder="Peanut" maxLength={80} required />
      </Field>
      <Field label="Reaction (optional)">
        <Input className={fieldClass} value={d.reaction} onChange={(e) => set({ reaction: e.target.value })} placeholder="Hives within minutes" maxLength={160} />
      </Field>
      <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-caption font-medium text-muted-foreground">How sure</legend>
        <div className="flex flex-wrap gap-2">
          {(["suspected", "confirmed"] as const).map((c) => {
            const Icon = allergyIcon[c];
            return (
              <label
                key={c}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-label transition-colors duration-150 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:min-h-9",
                  d.certainty === c ? "border-foreground/40 bg-card font-semibold" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <input type="radio" name="certainty" value={c} checked={d.certainty === c} onChange={() => set({ certainty: c })} className="sr-only" />
                <Icon className="size-4" aria-hidden />
                {c === "confirmed" ? "Confirmed by a doctor" : "Suspected, not tested yet"}
              </label>
            );
          })}
        </div>
      </fieldset>
      {showVisibility && <VisibilityField value={d.visibility} onChange={(visibility) => set({ visibility })} />}
    </EditorForm>
  );
}
