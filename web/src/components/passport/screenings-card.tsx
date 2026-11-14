"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { PassportPerson, Screening, ScreeningOptionGroup, Visibility } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { todayKey } from "@/lib/schedule";
import { useFamilyNow } from "@/components/shell/family-clock";
import { Input } from "@/components/ui/input";
import { AddButton, EditButton, EditorForm, Field, fieldClass, useSave, VisibilityField, VisibilityPicker } from "./edit-kit";
import { SectionCard } from "./section-card";

const OTHER = "other";

type Draft = { kind: string; name: string; takenOn: string; visibility: Visibility };

const bodyOf = (d: Draft) => ({ kind: d.kind, name: d.kind === OTHER ? d.name.trim() : undefined, takenOn: d.takenOn, visibility: d.visibility });

// Screenings on record (tests without one measured value: an anatomy scan, a
// hearing screen). The list to pick from comes from the API for this person's
// stage, so it lives in one place and changes with the stage and the child's age.
export function ScreeningsCard({ person, memberId }: { person: PassportPerson; memberId: string }) {
  const editable = person.isActingParent || person.kind === "child";
  const showVisibility = person.isActingParent;
  const childId = person.kind === "child" ? person.id : undefined;
  const [adding, setAdding] = useState<{ kind?: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const save = useSave();
  const options = person.screeningOptions;
  const done = new Set(person.screenings.map((s) => s.kind));
  // Starters for an empty list: the first few of the current stage's group not yet logged.
  const starters = (options[0]?.options ?? []).filter((o) => o.kind !== OTHER && !done.has(o.kind)).slice(0, 4);

  function share(s: Screening, visibility: Visibility) {
    save.run(
      () =>
        api.PUT("/members/{memberId}/screenings/{screeningId}", {
          params: { path: { memberId, screeningId: s.id } },
          body: bodyOf({ kind: s.kind, name: s.name, takenOn: s.takenOn, visibility }),
        }),
      "Could not change who can see it.",
    );
  }

  return (
    <SectionCard
      id="screenings-title"
      icon={passportIcon.screenings}
      title="Screenings"
      figure={
        <span className="flex items-center gap-3">
          {person.screenings.length > 0 && <span className="font-mono text-caption whitespace-nowrap text-muted-foreground max-sm:hidden">{person.screenings.length} on record</span>}
          {editable && !adding && <AddButton label="Add" onClick={() => setAdding({})} />}
        </span>
      }
    >
      {adding && (
        <ScreeningEditor
          key={adding.kind ?? "new"}
          memberId={memberId}
          childId={childId}
          options={options}
          initialKind={adding.kind}
          showVisibility={showVisibility}
          onClose={() => setAdding(null)}
          className="mb-4"
        />
      )}
      {person.screenings.length === 0
        ? !adding &&
          (editable && starters.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-label text-muted-foreground">None logged yet. Had one of these done?</p>
              <ul className="flex flex-wrap gap-2">
                {starters.map((o) => (
                  <li key={o.kind}>
                    <button
                      type="button"
                      onClick={() => setAdding({ kind: o.kind })}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-label outline-none transition-colors duration-150 hover:border-solid hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {o.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-label text-muted-foreground">No screenings on file yet.</p>
          ))
        : (
          <ul className="flex flex-col divide-y divide-border">
            {person.screenings.map((s) => (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                {editing === s.id ? (
                  <ScreeningEditor
                    memberId={memberId}
                    childId={childId}
                    options={options}
                    screening={s}
                    showVisibility={showVisibility}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-medium">{s.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-caption text-muted-foreground">
                        {formatLongDate(s.takenOn)}
                        {showVisibility && <VisibilityPicker value={s.visibility} onChange={(v) => share(s, v)} disabled={save.pending} />}
                      </p>
                    </div>
                    {editable && <EditButton label={`Edit ${s.name}`} onClick={() => setEditing(s.id)} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {editable && (
        <p className="mt-4 text-caption text-muted-foreground">
          The list holds screenings commonly offered at this stage, so you can log what was done. Which ones fit you is a question for your doctor.
        </p>
      )}
    </SectionCard>
  );
}

function ScreeningEditor({
  memberId,
  childId,
  options,
  screening,
  initialKind,
  showVisibility,
  onClose,
  className,
}: {
  memberId: string;
  childId?: string;
  options: ScreeningOptionGroup[];
  screening?: Screening;
  initialKind?: string;
  showVisibility: boolean;
  onClose: () => void;
  className?: string;
}) {
  const today = todayKey(useFamilyNow());
  const known = new Set(options.flatMap((g) => g.options.map((o) => o.kind)));
  const [d, setD] = useState<Draft>(
    screening
      ? { kind: screening.kind, name: screening.kind === OTHER ? screening.name : "", takenOn: screening.takenOn, visibility: screening.visibility }
      : { kind: initialKind ?? "", name: "", takenOn: today, visibility: childId ? "family" : "private" },
  );
  const save = useSave();
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  function submit() {
    if (!d.kind) return void toast.error("Pick the screening.");
    if (d.kind === OTHER && !d.name.trim()) return void toast.error("Type the name of the screening.");
    if (screening) {
      save.run(
        () => api.PUT("/members/{memberId}/screenings/{screeningId}", { params: { path: { memberId, screeningId: screening.id } }, body: bodyOf(d) }),
        "Could not save the screening.",
        onClose,
      );
    } else {
      save.run(() => api.POST("/members/{memberId}/screenings", { params: { path: { memberId } }, body: { childId, ...bodyOf(d) } }), "Could not log the screening.", onClose);
    }
  }

  function remove() {
    if (!screening) return;
    save.run(
      () => api.DELETE("/members/{memberId}/screenings/{screeningId}", { params: { path: { memberId, screeningId: screening.id } } }),
      "Could not remove the screening.",
      onClose,
    );
  }

  return (
    <EditorForm title={screening ? `Edit ${screening.name}` : "Log a screening"} pending={save.pending} onSubmit={submit} onCancel={onClose} onDelete={screening && remove} className={className}>
      <Field label="Screening">
        <select className={fieldClass} value={d.kind} onChange={(e) => set({ kind: e.target.value })} required>
          <option value="" disabled>
            Pick one
          </option>
          {/* A record from an earlier stage keeps its own entry so editing never changes it silently. */}
          {screening && !known.has(screening.kind) && <option value={screening.kind}>{screening.name}</option>}
          {options.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.kind} value={o.kind}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {d.kind === OTHER && (
        <Field label="Name">
          <Input className={fieldClass} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Thyroid ultrasound" maxLength={80} required />
        </Field>
      )}
      <Field label="Done on">
        <Input type="date" className={fieldClass} value={d.takenOn} max={today} onChange={(e) => set({ takenOn: e.target.value })} required />
      </Field>
      {showVisibility && <VisibilityField value={d.visibility} onChange={(visibility) => set({ visibility })} />}
    </EditorForm>
  );
}
