"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Flag, Minus, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { LeaveDeadline, LeavePlan, LeavePlanInput, LeaveProgram, LeaveSegment, ParentLeave } from "@/lib/api/types";
import { daysUntil, formatLongDate, formatShortDate } from "@/lib/format";
import { addDays, todayKey } from "@/lib/schedule";
import { daysLeftWords, toneClass, toneDot, type DueTone } from "@/lib/tasks";
import type { Person } from "@/lib/roles";
import { leaveEligibilityIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerAvatar } from "./owner";
import { useFamilyNow } from "@/components/shell/family-clock";
import { SourceLink } from "@/components/joy/source-line";

// Leave for both parents on one narrow timeline: today to a few months after
// birth. Segments are drawn from the API; the acting parent moves their own leave
// by dragging the bar or stepping start and length, and the API recomputes it.

const DAY = 86_400_000;
const POST_BIRTH_DAYS = 120;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// Token colour per program, the same for both parents. Unknown programs fall back to a neutral.
const programVar: Record<string, string> = { fmla: "var(--chart-3)", ca_pfl: "var(--chart-1)", ca_sdi: "var(--chart-2)", cfra: "var(--chart-4)" };
const colorOf = (id: string | undefined) => (id && programVar[id]) || "var(--chart-5)";

/** The program that gives the segment its colour: the one that pays, else the first. */
function leadId(seg: LeaveSegment, programs: LeaveProgram[]): string | undefined {
  const kindOf = (id: string) => programs.find((p) => p.id === id)?.kind;
  return seg.paid ? (seg.programIds.find((id) => kindOf(id) !== "job_protection") ?? seg.programIds[0]) : seg.programIds[0];
}

function segmentColor(seg: LeaveSegment, programs: LeaveProgram[]): string {
  const lead = leadId(seg, programs);
  return lead ? colorOf(lead) : "var(--muted-foreground)";
}

function bounds(p: ParentLeave) {
  const input = p.input;
  const first = p.segments[0]?.startsOn;
  const last = p.segments[p.segments.length - 1]?.endsOn;
  const start = input?.startsOn ?? first;
  const weeks = input?.weeksWanted ?? (first && last ? Math.max(1, Math.round(diff(first, last) / 7)) : undefined);
  return { start, weeks, first, last };
}

/** The status sentence for the Leave tab: the acting parent's next deadline, or the next step. */
export function leaveHeadline(plan: LeavePlan, selfId: string, now: Date): string {
  const me = plan.parents.find((p) => p.memberId === selfId);
  if (!me?.input) return "Answer four questions to see which leave you can take.";
  const next = me.deadlines[0];
  if (!next) return "Your leave dates are set. Drag the bar to move them.";
  return daysUntil(next.dueOn, now) < 0 ? `${next.title}. It was due ${formatShortDate(next.dueOn)}.` : `${next.title} by ${formatShortDate(next.dueOn)}.`;
}

function toneOf(dueOn: string, now: Date): DueTone {
  const d = daysUntil(dueOn, now);
  return d < 0 ? "late" : d <= 14 ? "due" : "up";
}

export function LeavePlanner({
  initial,
  people,
  selfId,
  dueOn,
  onOpenTask,
  onChange,
}: {
  initial: LeavePlan;
  people: Person[];
  selfId: string;
  dueOn?: string;
  onOpenTask: (taskId: string) => void;
  onChange: (plan: LeavePlan) => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [editingAnswers, setEditingAnswers] = useState(false);
  const seq = useRef(0);

  const now = useFamilyNow();
  const from = todayKey(now);
  const last = plan.parents.flatMap((p) => p.segments.map((s) => s.endsOn)).sort().at(-1);
  const to = addDays(dueOn ?? from, POST_BIRTH_DAYS) > (last ?? "") ? addDays(dueOn ?? from, POST_BIRTH_DAYS) : addDays(last!, 14);
  const win = { from, to, days: Math.max(1, diff(from, to)) };

  async function save(input: LeavePlanInput) {
    const mine = ++seq.current;
    const { data, error } = await api.PUT("/members/{memberId}/leave-plan", { params: { path: { memberId: selfId } }, body: input });
    if (mine !== seq.current) return false;
    if (error || !data) {
      toast.error("Could not save your leave. Please try again.");
      return false;
    }
    setPlan(data);
    onChange(data);
    return true;
  }

  const ticks = monthTicks(win);
  const programs = new Map<string, LeaveProgram>();
  for (const p of plan.parents) for (const pr of p.programs) programs.set(pr.id, pr);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Leave timeline" className="rounded-2xl border border-border bg-card p-3 md:p-5">
        <div className="relative mb-1 h-4" aria-hidden>
          {ticks.map((t) => (
            <span key={t.date} className="absolute -translate-x-1/2 font-mono text-caption text-muted-foreground first:translate-x-0" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {plan.parents.map((p) => (
            <ParentLane
              key={p.memberId}
              parent={p}
              person={people.find((x) => x.id === p.memberId)}
              mine={p.memberId === selfId}
              win={win}
              dueOn={dueOn}
              ticks={ticks}
              editingAnswers={editingAnswers && p.memberId === selfId}
              onToggleAnswers={() => setEditingAnswers((v) => !v)}
              onSave={save}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
        <Legend programs={[...programs.values()]} parents={plan.parents} />
      </section>
    </div>
  );
}

type Win = { from: string; to: string; days: number };
const pct = (win: Win, date: string) => Math.min(100, Math.max(0, (diff(win.from, date) / win.days) * 100));

function monthTicks(win: Win) {
  const out: { date: string; label: string; pct: number }[] = [{ date: win.from, label: "Today", pct: 0 }];
  const start = new Date(win.from + "T00:00:00Z");
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 10);
    if (d > win.to) break;
    const p = pct(win, d);
    // Keep clear of the "Today" label and the right edge.
    if (p < 12 || p > 94) continue;
    out.push({ date: d, label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(d)), pct: p });
  }
  return out;
}

function Legend({ programs, parents }: { programs: LeaveProgram[]; parents: ParentLeave[] }) {
  // Only programs that colour a bar: the others are explained under each parent.
  const lead = new Set(parents.flatMap((p) => p.segments.map((s) => leadId(s, p.programs))));
  const shown = programs.filter((p) => lead.has(p.id));
  if (shown.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-caption text-muted-foreground">
      {shown.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: colorOf(p.id) }} />
          {p.name}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-foreground/70" />
        Paid
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: stripes("var(--foreground)") }} />
        Unpaid
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-1 w-3 rounded-full bg-foreground/45" />
        Job held
      </span>
    </div>
  );
}

const stripes = (c: string) => `repeating-linear-gradient(135deg, color-mix(in oklch, ${c} 55%, transparent) 0 3px, color-mix(in oklch, ${c} 18%, transparent) 3px 6px)`;

function ParentLane({
  parent,
  person,
  mine,
  win,
  dueOn,
  ticks,
  editingAnswers,
  onToggleAnswers,
  onSave,
  onOpenTask,
}: {
  parent: ParentLeave;
  person?: Person;
  mine: boolean;
  win: Win;
  dueOn?: string;
  ticks: { date: string; pct: number }[];
  editingAnswers: boolean;
  onToggleAnswers: () => void;
  onSave: (input: LeavePlanInput) => Promise<boolean>;
  onOpenTask: (taskId: string) => void;
}) {
  const now = useFamilyNow();
  const name = person?.displayName ?? (parent.role === "mother" ? "Mom" : "Partner");
  const b = bounds(parent);
  const [draft, setDraft] = useState<{ start: string; weeks: number } | null>(null);
  const [dragDays, setDragDays] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const laneRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const start = draft?.start ?? b.start;
  const weeks = draft?.weeks ?? b.weeks;

  function queue(next: { start: string; weeks: number }) {
    if (!parent.input) return;
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // The API's answer replaces the preview, or the old dates come back when it fails.
      onSave({ ...parent.input!, startsOn: next.start, weeksWanted: next.weeks }).then(() => setDraft(null));
    }, 350);
  }

  // Preview of the pending change: the bar shifts and stretches before the API answers.
  const shift = b.start && start ? diff(b.start, start) : 0;
  const stretch = b.weeks && weeks ? (weeks - b.weeks) * 7 : 0;
  const segs = parent.segments.map((s, i, all) => ({
    ...s,
    startsOn: addDays(s.startsOn, shift),
    endsOn: addDays(s.endsOn, shift + (i === all.length - 1 ? stretch : 0)),
  }));
  const barFrom = segs[0]?.startsOn;
  const barTo = segs[segs.length - 1]?.endsOn;

  function endDrag() {
    const moving = dragFrom.current !== null;
    dragFrom.current = null;
    const days = dragDays;
    setDragDays(0);
    if (moving && days !== 0 && start && weeks) queue({ start: addDays(start, days), weeks });
  }

  const deadlines = parent.deadlines;
  const eligible = parent.programs.filter((p) => p.eligibility === "eligible");

  return (
    <section aria-label={`${name}'s leave`} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <OwnerAvatar person={person} />
        <h2 className="text-title">{mine ? `${name} (you)` : name}</h2>
        {start && weeks ? (
          <p className="font-mono text-label text-muted-foreground">
            {formatShortDate(start)} to {formatShortDate(addDays(start, weeks * 7))} · {weeks} wk
          </p>
        ) : null}
        {mine && parent.input && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-11 gap-1.5 text-label md:h-8" aria-expanded={editingAnswers} onClick={onToggleAnswers}>
            <Settings2 aria-hidden />
            My answers
          </Button>
        )}
      </header>

      {!parent.input && !mine && <p className="rounded-xl bg-muted px-4 py-3 text-label text-muted-foreground">{name} has not filled in their answers yet. Their leave appears here once they do.</p>}
      {(editingAnswers || (!parent.input && mine)) && (
        <AnswersForm
          initial={parent.input}
          first={!parent.input}
          onSave={async (input) => {
            const ok = await onSave(input);
            if (ok && editingAnswers) onToggleAnswers();
            return ok;
          }}
        />
      )}

      {parent.input && (
        <>
          <div ref={laneRef} className="relative h-14 rounded-xl bg-muted/70" role="img" aria-label={laneDescription(parent, start, weeks)}>
            {ticks.slice(1).map((t) => (
              <span key={t.date} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${t.pct}%` }} />
            ))}
            {dueOn && dueOn >= win.from && dueOn <= win.to && (
              <span aria-hidden className="absolute inset-y-0 z-10 w-0.5 bg-foreground/60" style={{ left: `${pct(win, dueOn)}%` }}>
                <span className="absolute -bottom-5 left-1 font-mono text-caption whitespace-nowrap text-muted-foreground">Due {formatShortDate(dueOn)}</span>
              </span>
            )}
            <div className="absolute inset-y-3" style={{ left: 0, right: 0, transform: `translateX(${(dragDays / win.days) * 100}%)` }}>
              {segs.map((s) => {
                const l = pct(win, s.startsOn);
                const r = pct(win, s.endsOn);
                const color = segmentColor(s, parent.programs);
                return (
                  <span
                    key={s.startsOn}
                    aria-hidden
                    className={cn("absolute inset-y-0 overflow-hidden rounded-md", s.paid ? "" : "border border-dashed")}
                    style={{ left: `${l}%`, width: `${Math.max(0, r - l)}%`, background: s.paid ? color : stripes(color), borderColor: color }}
                  >
                    {(r - l) / 100 * win.days >= 28 && <span className={cn("flex h-full items-center justify-center font-mono text-caption", s.paid ? "text-white" : "text-foreground")}>{Math.round(diff(s.startsOn, s.endsOn) / 7)} wk</span>}
                  </span>
                );
              })}
              {segs.filter((s) => s.jobProtected).map((s) => (
                <span key={`job-${s.startsOn}`} aria-hidden className="absolute -bottom-1.5 h-1 rounded-full bg-foreground/45" style={{ left: `${pct(win, s.startsOn)}%`, width: `${Math.max(0, pct(win, s.endsOn) - pct(win, s.startsOn))}%` }} />
              ))}
              {mine && barFrom && barTo && (
                <span
                  aria-hidden
                  className="absolute inset-y-[-8px] z-20 cursor-grab touch-pan-y rounded-lg active:cursor-grabbing"
                  style={{ left: `${pct(win, barFrom)}%`, width: `${Math.max(2, pct(win, barTo) - pct(win, barFrom))}%` }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragFrom.current = e.clientX;
                  }}
                  onPointerMove={(e) => {
                    if (dragFrom.current !== null && laneRef.current) setDragDays(Math.round(((e.clientX - dragFrom.current) / laneRef.current.clientWidth) * win.days));
                  }}
                  onPointerUp={endDrag}
                  onPointerCancel={() => {
                    dragFrom.current = null;
                    setDragDays(0);
                  }}
                />
              )}
            </div>
            {deadlines.map((d) => (
              <span
                key={d.title + d.dueOn}
                aria-hidden
                title={`${d.title}, ${formatShortDate(d.dueOn)}`}
                className={cn("absolute top-0 z-30 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card", toneDot[toneOf(d.dueOn, now)])}
                style={{ left: `${pct(win, d.dueOn)}%` }}
              >
                <Flag className="size-3 text-card" />
              </span>
            ))}
          </div>

          {mine && start && weeks && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Stepper label="Start" value={formatLongDate(start)} onMinus={() => queue({ start: addDays(start, -7), weeks })} onPlus={() => queue({ start: addDays(start, 7), weeks })} unit="a week" />
              <Stepper label="Length" value={`${weeks} ${weeks === 1 ? "week" : "weeks"}`} onMinus={() => queue({ start, weeks: Math.max(1, weeks - 1) })} onPlus={() => queue({ start, weeks: Math.min(52, weeks + 1) })} unit="a week" />
            </div>
          )}

          {deadlines.length > 0 && (
            <ul className="mt-2 divide-y divide-border" aria-label={`${name}'s deadlines`}>
              {deadlines.map((d) => (
                <DeadlineRow key={d.title + d.dueOn} d={d} onOpen={onOpenTask} />
              ))}
            </ul>
          )}

          {parent.programs.length > 0 && (
            <details className="group text-label">
              <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-muted-foreground select-none md:min-h-8">
                <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
                {eligible.length} of {parent.programs.length} programs fit your answers
              </summary>
              <ul className="mt-1 flex flex-col gap-3 pl-5">
                {parent.programs.map((p) => (
                  <ProgramRow key={p.id} p={p} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function laneDescription(p: ParentLeave, start?: string, weeks?: number): string {
  if (!start || !weeks) return "No leave dates yet";
  const paid = p.segments.filter((s) => s.paid).reduce((n, s) => n + diff(s.startsOn, s.endsOn), 0) / 7;
  return `Leave from ${formatLongDate(start)} for ${weeks} weeks, ${Math.round(paid)} of them paid`;
}

function Stepper({ label, value, onMinus, onPlus, unit }: { label: string; value: string; onMinus: () => void; onPlus: () => void; unit: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <span className="w-14 text-label text-muted-foreground">{label}</span>
      <Button type="button" variant="outline" size="icon" className="size-11 md:size-8" onClick={onMinus} aria-label={`${label} ${unit} earlier or shorter`}>
        <Minus aria-hidden />
      </Button>
      <span className="min-w-28 text-center font-mono text-label" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="outline" size="icon" className="size-11 md:size-8" onClick={onPlus} aria-label={`${label} ${unit} later or longer`}>
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

function DeadlineRow({ d, onOpen }: { d: LeaveDeadline; onOpen: (taskId: string) => void }) {
  const now = useFamilyNow();
  const days = daysUntil(d.dueOn, now);
  const tone = toneOf(d.dueOn, now);
  const inner = (
    <>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", toneClass[tone])}>
        <Flag aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-body font-medium">{d.title}</span>
        <span className="block font-mono text-caption text-muted-foreground">
          {formatShortDate(d.dueOn)} · {daysLeftWords(days)}
        </span>
      </span>
    </>
  );
  return (
    <li>
      {d.taskId ? (
        <button type="button" onClick={() => onOpen(d.taskId!)} className="flex min-h-11 w-full items-center gap-3 rounded-lg py-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
          {inner}
          <span className="inline-flex items-center gap-0.5 text-label text-primary">
            Paperwork
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-3 py-2">{inner}</div>
      )}
    </li>
  );
}

const eligibilityWord = { eligible: "Eligible", not_eligible: "Not eligible", unknown: "Ask HR" } as const;

function ProgramRow({ p }: { p: LeaveProgram }) {
  const Icon = leaveEligibilityIcon[p.eligibility];
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(p.id) }} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-body font-medium">
          {p.name}
          <span className="inline-flex items-center gap-1 text-caption font-normal text-muted-foreground">
            <Icon aria-hidden className="size-3.5" />
            {eligibilityWord[p.eligibility]}
            {p.weeks ? ` · up to ${p.weeks} weeks` : ""}
          </span>
        </p>
        <p className="text-label text-muted-foreground">{[p.pay, p.reason].filter(Boolean).join(" ")}</p>
        <SourceLink source={p.source} className="w-fit text-caption" />
      </div>
    </li>
  );
}

function AnswersForm({ initial, first, onSave }: { initial?: LeavePlanInput; first: boolean; onSave: (input: LeavePlanInput) => Promise<boolean> }) {
  const [state, setState] = useState(initial?.state ?? "");
  const [employees, setEmployees] = useState(initial ? String(initial.employerEmployees) : "");
  const [months, setMonths] = useState(initial ? String(initial.monthsEmployed) : "");
  const [hours, setHours] = useState(initial ? String(initial.hoursLast12Months) : "");
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Za-z]{2}$/.test(state) && employees !== "" && months !== "" && hours !== "";
  return (
    <form
      className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 md:p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        await onSave({ ...initial, state: state.toUpperCase(), employerEmployees: Number(employees), monthsEmployed: Number(months), hoursLast12Months: Number(hours) });
        setBusy(false);
      }}
    >
      <Field id="leave-state" label="Your state">
        <Input id="leave-state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="CA" autoComplete="off" className="h-11 font-mono uppercase md:h-9" />
      </Field>
      <Field id="leave-employees" label="Employees at your worksite">
        <Input id="leave-employees" type="number" inputMode="numeric" min={0} max={1000000} value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder="0 if self-employed" className="h-11 font-mono md:h-9" />
      </Field>
      <Field id="leave-months" label="Months with this employer">
        <Input id="leave-months" type="number" inputMode="numeric" min={0} max={600} value={months} onChange={(e) => setMonths(e.target.value)} className="h-11 font-mono md:h-9" />
      </Field>
      <Field id="leave-hours" label="Hours worked in the last 12 months">
        <Input id="leave-hours" type="number" inputMode="numeric" min={0} max={8784} value={hours} onChange={(e) => setHours(e.target.value)} className="h-11 font-mono md:h-9" />
      </Field>
      <Button type="submit" disabled={!valid || busy} className="h-11 sm:col-span-2 sm:w-fit md:h-9">
        {first ? "Show my leave" : "Save answers"}
      </Button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      {children}
    </div>
  );
}
