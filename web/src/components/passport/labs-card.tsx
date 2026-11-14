"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { LabResult, PassportPerson, Visibility } from "@/lib/api/types";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { passportIcon } from "@/lib/visuals";
import { todayKey } from "@/lib/schedule";
import { useFamilyNow } from "@/components/shell/family-clock";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AddButton, EditButton, EditorForm, Field, fieldClass, optNum, useSave, VisibilityField, VisibilityPicker } from "./edit-kit";
import { LabFlag } from "./lab-flag";
import { RangeBar } from "./range-bar";
import { EmptyLine, SectionCard } from "./section-card";
import { labPosition } from "./summary";

const positionText = { low: "Below range", in: "In range", high: "Above range", unknown: "No range given" } as const;

type Draft = { name: string; value: string; unit: string; refLow: string; refHigh: string; takenOn: string; visibility: Visibility };

const toDraft = (l: LabResult): Draft => ({
  name: l.name,
  value: String(l.value),
  unit: l.unit,
  refLow: l.refLow == null ? "" : String(l.refLow),
  refHigh: l.refHigh == null ? "" : String(l.refHigh),
  takenOn: l.takenOn,
  visibility: l.visibility,
});

function body(d: Draft) {
  return {
    name: d.name.trim(),
    value: Number(d.value),
    unit: d.unit.trim(),
    refLow: optNum(d.refLow),
    refHigh: optNum(d.refHigh),
    takenOn: d.takenOn,
    visibility: d.visibility,
  };
}

/** Results grouped by test, newest first inside each, in the API's newest-first order. */
function byTest(labs: LabResult[]): LabResult[][] {
  const groups = new Map<string, LabResult[]>();
  for (const l of labs) groups.set(l.name, [...(groups.get(l.name) ?? []), l]);
  return [...groups.values()];
}

// Lab results: the latest value per test, earlier values under it. Each value
// sits on its own report's reference range, and a flagged value says in place
// why it is flagged. Whoever may log for this person can edit and remove any
// value; the visibility chip changes in place.
export function LabsCard({ person, memberId, canAsk }: { person: PassportPerson; memberId: string; canAsk: boolean }) {
  const editable = person.isActingParent || person.kind === "child";
  const showVisibility = person.isActingParent;
  const [adding, setAdding] = useState(false);
  const tests = byTest(person.labs);
  const flagged = tests.filter(([l]) => l.flag).length;
  const childId = person.kind === "child" ? person.id : undefined;
  return (
    <SectionCard
      id="labs-title"
      icon={passportIcon.labs}
      title="Lab results"
      figure={
        <span className="flex items-center gap-3">
          {tests.length > 0 && (
            <span className="font-mono text-caption whitespace-nowrap text-muted-foreground max-sm:hidden">
              {tests.length} {tests.length === 1 ? "test" : "tests"}
              {flagged > 0 && <span className="text-status-due"> · {flagged} to discuss</span>}
            </span>
          )}
          {editable && !adding && <AddButton label="Add" onClick={() => setAdding(true)} />}
        </span>
      }
    >
      {adding && <LabEditor memberId={memberId} childId={childId} showVisibility={showVisibility} onClose={() => setAdding(false)} className="mb-4" />}
      {tests.length === 0
        ? !adding && <EmptyLine>No lab results yet. Add one from a lab report: the value, its unit and the range printed beside it.</EmptyLine>
        : (
          <ul className="flex flex-col divide-y divide-border">
            {tests.map(([latest, ...earlier]) => (
              <LabRow
                key={latest.id}
                lab={latest}
                earlier={earlier}
                memberId={memberId}
                childId={childId}
                editable={editable}
                showVisibility={showVisibility}
                canAsk={canAsk}
                owner={person.kind === "child" ? person.name : undefined}
              />
            ))}
          </ul>
        )}
    </SectionCard>
  );
}

function LabRow({
  lab,
  earlier,
  memberId,
  childId,
  editable,
  showVisibility,
  canAsk,
  owner,
}: {
  lab: LabResult;
  earlier: LabResult[];
  memberId: string;
  childId?: string;
  editable: boolean;
  showVisibility: boolean;
  canAsk: boolean;
  owner?: string;
}) {
  const [editing, setEditing] = useState<LabResult | null>(null);
  const save = useSave();
  const pos = labPosition(lab);
  const out = pos === "low" || pos === "high";
  const Arrow = pos === "low" ? ArrowDown : ArrowUp;

  function share(visibility: Visibility) {
    save.run(
      () => api.PUT("/members/{memberId}/lab-results/{labId}", { params: { path: { memberId, labId: lab.id } }, body: body({ ...toDraft(lab), visibility }) }),
      "Could not change who can see it.",
    );
  }

  return (
    <li id={`lab-${lab.id}`} className="flex scroll-mt-24 flex-col gap-3 py-4 first:pt-0 last:pb-0">
      {editing ? (
        <LabEditor key={editing.id} memberId={memberId} childId={childId} lab={editing} showVisibility={showVisibility} onClose={() => setEditing(null)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-medium">{lab.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-caption text-muted-foreground">
                {formatLongDate(lab.takenOn)}
                {showVisibility && <VisibilityPicker value={lab.visibility} onChange={share} disabled={save.pending} />}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {out && (
                <span className="flex size-6 items-center justify-center rounded-full bg-status-due-soft text-status-due">
                  <Arrow className="size-3.5" aria-hidden />
                </span>
              )}
              <span className="font-mono text-title tabular-nums">
                {lab.value} <span className="text-label font-normal text-muted-foreground">{lab.unit}</span>
              </span>
              <span className="sr-only">{positionText[pos]}</span>
              {editable && <EditButton label={`Edit ${lab.name}`} onClick={() => setEditing(lab)} />}
            </div>
          </div>
          <RangeBar lab={lab} ends />
          {pos === "unknown" && <p className="text-caption text-muted-foreground">No reference range entered, so there is nothing to compare it with.</p>}
          <LabFlag lab={lab} memberId={memberId} canAsk={canAsk} owner={owner} />
        </>
      )}
      {earlier.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
          <span className="mr-1">Earlier</span>
          {earlier.map((e) => {
            const ePos = labPosition(e);
            const content = (
              <>
                <span className={cn("tabular-nums", (ePos === "low" || ePos === "high") && "text-status-due")}>
                  {e.value} {e.unit}
                </span>
                <span>· {formatShortDate(e.takenOn)}</span>
              </>
            );
            const chip = "inline-flex min-h-8 items-center gap-1 rounded-full bg-muted px-2.5 font-mono";
            return editable ? (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditing(e)}
                aria-label={`Edit ${e.name} from ${formatLongDate(e.takenOn)}`}
                className={cn(chip, "outline-none transition-colors duration-150 hover:bg-muted/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50")}
              >
                {content}
              </button>
            ) : (
              <span key={e.id} className={chip}>
                {content}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

/** Add or edit one lab value. Without `lab` it creates one. */
function LabEditor({
  memberId,
  childId,
  lab,
  showVisibility,
  onClose,
  className,
}: {
  memberId: string;
  childId?: string;
  lab?: LabResult;
  showVisibility: boolean;
  onClose: () => void;
  className?: string;
}) {
  const today = todayKey(useFamilyNow());
  // A child's records are readable by both parents whatever the visibility, so
  // the field is hidden there and "family" says what actually happens.
  const [d, setD] = useState<Draft>(
    lab ? toDraft(lab) : { name: "", value: "", unit: "", refLow: "", refHigh: "", takenOn: today, visibility: childId ? "family" : "private" },
  );
  const save = useSave();
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  function submit() {
    if (!d.name.trim() || d.value.trim() === "" || Number.isNaN(Number(d.value)) || !d.unit.trim()) {
      toast.error("Add the test name, value and unit.");
      return;
    }
    if (lab) {
      save.run(
        () => api.PUT("/members/{memberId}/lab-results/{labId}", { params: { path: { memberId, labId: lab.id } }, body: body(d) }),
        "Could not save the result.",
        onClose,
      );
    } else {
      save.run(() => api.POST("/members/{memberId}/lab-results", { params: { path: { memberId } }, body: { childId, ...body(d) } }), "Could not add the result.", onClose);
    }
  }

  function remove() {
    if (!lab) return;
    save.run(() => api.DELETE("/members/{memberId}/lab-results/{labId}", { params: { path: { memberId, labId: lab.id } } }), "Could not remove the result.", onClose);
  }

  return (
    <EditorForm title={lab ? `Edit ${lab.name}` : "Add a lab result"} pending={save.pending} onSubmit={submit} onCancel={onClose} onDelete={lab && remove} className={className}>
      <Field label="Test">
        <Input className={fieldClass} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ferritin" required />
      </Field>
      <Field label="Value and unit">
        <div className="flex gap-2">
          <Input className={fieldClass} inputMode="decimal" value={d.value} onChange={(e) => set({ value: e.target.value })} placeholder="18" required />
          <Input className={cn(fieldClass, "w-28")} value={d.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="ng/mL" aria-label="Unit" required />
        </div>
      </Field>
      <Field label="Reference range printed on the report, low to high" className="sm:col-span-2">
        <div className="flex items-center gap-2">
          <Input className={fieldClass} inputMode="decimal" value={d.refLow} onChange={(e) => set({ refLow: e.target.value })} placeholder="30" aria-label="Low end" />
          <span className="text-label text-muted-foreground" aria-hidden>
            to
          </span>
          <Input className={fieldClass} inputMode="decimal" value={d.refHigh} onChange={(e) => set({ refHigh: e.target.value })} placeholder="200" aria-label="High end" />
        </div>
      </Field>
      <Field label="Taken on">
        <Input type="date" className={fieldClass} value={d.takenOn} max={today} onChange={(e) => set({ takenOn: e.target.value })} required />
      </Field>
      {showVisibility && <VisibilityField value={d.visibility} onChange={(visibility) => set({ visibility })} />}
    </EditorForm>
  );
}
