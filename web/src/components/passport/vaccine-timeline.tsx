"use client";

import { useState } from "react";
import { Check, CircleAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { VaccineDose, VaccineKey, VaccineStatus } from "@/lib/api/types";
import { daysUntil, formatLongDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { todayKey } from "@/lib/schedule";
import { vaccineKey, vaccineName } from "@/lib/vaccines";
import { cn } from "@/lib/utils";
import { useFamilyNow } from "@/components/shell/family-clock";
import { Input } from "@/components/ui/input";
import { AddButton, EditButton, EditorForm, Field, fieldClass, useSave } from "./edit-kit";
import { EmptyLine, SectionCard } from "./section-card";

const dot: Record<VaccineStatus, string> = {
  done: "border-status-ok bg-status-ok text-card",
  overdue: "border-status-late bg-status-late-soft text-status-late",
  due: "border-status-due bg-status-due-soft text-status-due",
  upcoming: "border-border bg-card",
};
const word: Record<VaccineStatus, string> = { done: "Given", overdue: "Overdue", due: "Due", upcoming: "Upcoming" };
const mark: Partial<Record<VaccineStatus, typeof Check>> = { done: Check, due: Clock, overdue: CircleAlert };

function inDays(n: number): string {
  if (n === 0) return "today";
  const d = Math.abs(n);
  const span = d === 1 ? "1 day" : `${d} days`;
  return n > 0 ? `in ${span}` : `${span} ago`;
}

/** Where the timeline can write: the acting parent's own doses or a child's. */
export type VaccineEdit = { memberId: string; childId?: string };

type Prefill = { vaccine: VaccineKey; dose: string; rowId: string };
type Editing = { dose?: VaccineDose; prefill?: Prefill };

// Vertical timeline, given and expected doses in date order. The mark carries
// the status; a due or overdue dose says when in words and, where the parent
// may log, offers "Log as given" on its own row. Given doses can be corrected
// or removed. Read-only without `edit` (the child home uses it that way).
export function VaccineTimeline({ vaccines: doses, edit }: { vaccines: VaccineDose[]; edit?: VaccineEdit }) {
  const now = useFamilyNow();
  const [editing, setEditing] = useState<Editing | null>(null);
  const when = (v: VaccineDose) => (v.status === "done" ? v.givenOn : v.dueOn) ?? "";
  const vaccines = [...doses].sort((a, b) => when(a).localeCompare(when(b)));
  const given = vaccines.filter((v) => v.status === "done").length;
  const editor = (e: Editing) =>
    edit && <DoseEditor key={e.dose?.id ?? e.prefill?.rowId ?? "new"} {...edit} dose={e.dose} prefill={e.prefill} onClose={() => setEditing(null)} />;
  const editingId = editing?.dose?.id ?? editing?.prefill?.rowId;

  return (
    <SectionCard
      id="vaccines-title"
      icon={passportIcon.vaccines}
      title="Vaccines"
      figure={
        <span className="flex items-center gap-3">
          {vaccines.length > 0 && (
            <span className="font-mono text-caption whitespace-nowrap text-muted-foreground max-sm:hidden">
              {given} of {vaccines.length} given
            </span>
          )}
          {edit && !editing && <AddButton label="Add" onClick={() => setEditing({})} />}
        </span>
      }
    >
      {editing && !editingId && <div className="mb-4">{editor(editing)}</div>}
      {vaccines.length === 0 ? (
        !editing && <EmptyLine>No vaccines on file yet.</EmptyLine>
      ) : (
        <ol>
          {vaccines.map((v, i) => {
            const Mark = mark[v.status];
            const open = v.status === "due" || v.status === "overdue";
            const key = vaccineKey(v.name);
            return (
              <li key={v.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < vaccines.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />}
                <span aria-hidden className={cn("z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2", dot[v.status])}>
                  {Mark && <Mark className="size-3.5" strokeWidth={v.status === "done" ? 3 : 2.5} />}
                </span>
                <div className="min-w-0 flex-1">
                  {editing && editingId === v.id ? (
                    editor(editing)
                  ) : (
                    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-body font-medium">
                        {v.name} <span className="text-label font-normal text-muted-foreground">{v.dose}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        {open ? (
                          <p className={cn("text-label font-medium", v.status === "due" ? "text-status-due" : "text-status-late")}>
                            {v.status === "overdue" ? "Was due" : "Due"} {inDays(daysUntil(v.dueOn ?? "", now))}
                          </p>
                        ) : (
                          <p className="font-mono text-caption text-muted-foreground">
                            <span className="sr-only">{word[v.status]}, </span>
                            {v.status === "upcoming" && "by "}
                            {formatLongDate(when(v))}
                          </p>
                        )}
                        {edit && open && key && (
                          <button
                            type="button"
                            onClick={() => setEditing({ prefill: { vaccine: key, dose: v.dose, rowId: v.id } })}
                            className={cn(
                              "inline-flex min-h-11 items-center rounded-full px-3 text-label font-semibold outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8",
                              v.status === "overdue" ? "bg-status-late-soft text-status-late" : "bg-status-due-soft text-status-due",
                            )}
                          >
                            Log as given
                          </button>
                        )}
                        {edit && v.status === "done" && <EditButton label={`Edit ${v.name}`} onClick={() => setEditing({ dose: v })} />}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

/** Log a dose (new, or one the schedule expects) or correct a given dose. */
function DoseEditor({ memberId, childId, dose, prefill, onClose }: VaccineEdit & { dose?: VaccineDose; prefill?: Prefill; onClose: () => void }) {
  const today = todayKey(useFamilyNow());
  const [vaccine, setVaccine] = useState<VaccineKey | "">((dose ? vaccineKey(dose.name) : prefill?.vaccine) ?? "");
  const [label, setLabel] = useState(dose?.dose ?? prefill?.dose ?? "");
  const [givenOn, setGivenOn] = useState(dose?.givenOn ?? today);
  const save = useSave();

  function submit() {
    if (!vaccine) return void toast.error("Pick the vaccine.");
    const body = { vaccine, dose: label.trim() || undefined, givenOn };
    if (dose) {
      save.run(
        () => api.PUT("/members/{memberId}/immunizations/{immunizationId}", { params: { path: { memberId, immunizationId: dose.id } }, body }),
        "Could not save the dose.",
        onClose,
      );
    } else {
      save.run(() => api.POST("/members/{memberId}/immunizations", { params: { path: { memberId } }, body: { childId, ...body } }), "Could not log the dose.", onClose);
    }
  }

  function remove() {
    if (!dose) return;
    save.run(
      () => api.DELETE("/members/{memberId}/immunizations/{immunizationId}", { params: { path: { memberId, immunizationId: dose.id } } }),
      "Could not remove the dose.",
      onClose,
    );
  }

  return (
    <EditorForm title={dose ? `Edit ${dose.name}` : "Log a vaccine dose"} pending={save.pending} onSubmit={submit} onCancel={onClose} onDelete={dose && remove}>
      <Field label="Vaccine">
        <select className={fieldClass} value={vaccine} onChange={(e) => setVaccine(e.target.value as VaccineKey)} required>
          <option value="" disabled>
            Pick one
          </option>
          {(Object.keys(vaccineName) as VaccineKey[]).map((k) => (
            <option key={k} value={k}>
              {vaccineName[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Dose (optional)">
        <Input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dose 2 of 5" maxLength={60} />
      </Field>
      <Field label="Given on">
        <Input type="date" className={fieldClass} value={givenOn} max={today} onChange={(e) => setGivenOn(e.target.value)} required />
      </Field>
    </EditorForm>
  );
}
