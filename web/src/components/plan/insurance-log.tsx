"use client";

import { useState } from "react";
import { CalendarClock, Check, Copy, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { InsuranceCall, InsuranceCallTopic, Visibility } from "@/lib/api/types";
import { daysUntil, formatLongDate, formatShortDate } from "@/lib/format";
import type { Person } from "@/lib/roles";
import { todayKey } from "@/lib/schedule";
import { daysLeftWords, toneClass, type DueTone } from "@/lib/tasks";
import { insuranceTopicIcon, insuranceTopicLabel, visibilityIcon } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VisibilityChip, visibilityShort } from "@/components/passport/visibility-chip";

// Calls with the health insurer are sensitive records: the author picks who sees
// each one and it starts private. care_team is left out of the picker because it
// means nothing for a call (the API treats it like private).
const visibilityChoices: Visibility[] = ["private", "partner", "family"];
const topics = Object.keys(insuranceTopicLabel) as InsuranceCallTopic[];

/** Open follow-ups first, soonest first; calls without one follow, newest first. */
export function byFollowUp(calls: InsuranceCall[]): InsuranceCall[] {
  return [...calls].sort((a, b) => {
    if (a.followUpOn && b.followUpOn) return a.followUpOn.localeCompare(b.followUpOn);
    if (a.followUpOn) return -1;
    if (b.followUpOn) return 1;
    return b.calledAt.localeCompare(a.calledAt);
  });
}

/** The status sentence for the tab: the next follow-up, or what to do first. */
export function insuranceHeadline(calls: InsuranceCall[], selfId: string): string {
  const next = byFollowUp(calls.filter((c) => c.authorId === selfId)).find((c) => c.followUpOn);
  if (next?.followUpOn) return daysUntil(next.followUpOn) < 0 ? `Your follow-up with ${next.insurer} is late.` : `Follow up with ${next.insurer} by ${formatShortDate(next.followUpOn)}.`;
  return calls.length === 0 ? "Log your first call with the insurer. Keep the reference number." : "No follow-ups waiting. Log the next call when you make it.";
}

function followTone(on: string): DueTone {
  const d = daysUntil(on);
  return d < 0 ? "late" : d <= 3 ? "due" : "up";
}

export function InsuranceLog({ calls, people, selfId, onCreated }: { calls: InsuranceCall[]; people: Person[]; selfId: string; onCreated: (call: InsuranceCall) => void }) {
  const [open, setOpen] = useState(calls.length === 0);
  const ordered = byFollowUp(calls);
  return (
    <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] print:block">
      <div className="flex flex-wrap items-center gap-2 lg:col-span-2 print:hidden">
        <Button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-11 md:h-9">
          <Plus aria-hidden />
          Log a call
        </Button>
        {calls.length > 0 && (
          <Button type="button" variant="outline" onClick={() => window.print()} className="ml-auto h-11 md:h-9">
            <Printer aria-hidden />
            Print
          </Button>
        )}
      </div>

      {open && (
        <CallForm
          lastInsurer={ordered.find((c) => c.authorId === selfId)?.insurer}
          selfId={selfId}
          onCreated={(c) => {
            onCreated(c);
            setOpen(false);
          }}
        />
      )}

      <section aria-labelledby="calls-title" className={cn("min-w-0", !open && "lg:col-span-2")}>
        <h2 id="calls-title" className="text-title">
          <span className="hidden print:inline">Insurance calls, printed {formatLongDate(todayKey())}</span>
          <span className="print:hidden">Calls by follow-up date</span>
        </h2>
        {ordered.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No calls yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border 2xl:grid 2xl:grid-cols-2 2xl:gap-x-8">
            {ordered.map((c) => (
              <CallRow key={c.id} call={c} author={c.authorId === selfId ? undefined : people.find((p) => p.id === c.authorId)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CallRow({ call, author }: { call: InsuranceCall; author?: Person }) {
  const Icon = insuranceTopicIcon[call.topic];
  const [copied, setCopied] = useState(false);
  const tone = call.followUpOn ? followTone(call.followUpOn) : undefined;
  return (
    <li className="flex gap-3 py-4 print:break-inside-avoid">
      <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground print:hidden">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-body font-medium">
            {call.insurer}
            {call.representative ? <span className="font-normal text-muted-foreground">, {call.representative}</span> : null}
          </p>
          <span className="text-label text-muted-foreground">{insuranceTopicLabel[call.topic]}</span>
          <span className="print:hidden">
            <VisibilityChip visibility={call.visibility} />
          </span>
        </div>
        <p className="mt-1 text-body">{call.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
          <span className="font-mono">{formatLongDate(call.calledAt.slice(0, 10))}</span>
          {author && <span>Logged by {author.displayName}</span>}
          {call.referenceNumber && (
            <span className="inline-flex items-center gap-1">
              Ref <span className="font-mono text-foreground">{call.referenceNumber}</span>
              <button
                type="button"
                aria-label={`Copy reference ${call.referenceNumber}`}
                className="-m-2.5 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:m-0 md:size-6 print:hidden"
                onClick={async () => {
                  await navigator.clipboard?.writeText(call.referenceNumber!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
              </button>
            </span>
          )}
          {call.followUpOn && tone && (
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 print:bg-transparent print:px-0", toneClass[tone])}>
              <CalendarClock aria-hidden className="size-3.5" />
              <span>
                Follow up <span className="font-mono">{formatShortDate(call.followUpOn)}</span>, {daysLeftWords(daysUntil(call.followUpOn))}
              </span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function CallForm({ lastInsurer, selfId, onCreated }: { lastInsurer?: string; selfId: string; onCreated: (call: InsuranceCall) => void }) {
  const [insurer, setInsurer] = useState(lastInsurer ?? "");
  const [rep, setRep] = useState("");
  const [ref, setRef] = useState("");
  const [topic, setTopic] = useState<InsuranceCallTopic>("coverage");
  const [summary, setSummary] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [busy, setBusy] = useState(false);
  const valid = insurer.trim() !== "" && summary.trim() !== "";

  return (
    <form
      className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        const { data, error } = await api.POST("/members/{memberId}/insurance-calls", {
          params: { path: { memberId: selfId } },
          body: {
            calledAt: new Date().toISOString(),
            insurer: insurer.trim(),
            ...(rep.trim() ? { representative: rep.trim() } : {}),
            ...(ref.trim() ? { referenceNumber: ref.trim() } : {}),
            topic,
            summary: summary.trim(),
            ...(followUpOn ? { followUpOn } : {}),
            visibility,
          },
        });
        setBusy(false);
        if (error || !data) {
          toast.error("Could not save the call. Please try again.");
          return;
        }
        onCreated(data);
        toast("Call saved", { description: followUpOn ? `Follow-up on ${formatShortDate(followUpOn)}.` : undefined });
      }}
    >
      <Field id="call-insurer" label="Who you called">
        <Input id="call-insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} maxLength={80} placeholder="Insurer" className="h-11 md:h-9" />
      </Field>
      <Field id="call-rep" label="Spoke with, optional">
        <Input id="call-rep" value={rep} onChange={(e) => setRep(e.target.value)} maxLength={80} className="h-11 md:h-9" />
      </Field>
      <Field id="call-ref" label="Reference number">
        <Input id="call-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} className="h-11 font-mono md:h-9" />
      </Field>
      <Field id="call-follow" label="Follow-up date, optional">
        <Input id="call-follow" type="date" min={todayKey()} value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} className="h-11 font-mono md:h-9" />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-label font-medium">What it was about</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const Icon = insuranceTopicIcon[t];
            return (
              <label key={t} className="has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-label md:min-h-9">
                <input type="radio" name="call-topic" className="sr-only" checked={topic === t} onChange={() => setTopic(t)} />
                <Icon aria-hidden className="size-4" />
                {insuranceTopicLabel[t]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field id="call-summary" label="Outcome: what they said and promised" className="sm:col-span-2">
        <Textarea id="call-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} rows={3} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-label font-medium">Who can see this call</legend>
        <div className="flex flex-wrap gap-2">
          {visibilityChoices.map((v) => {
            const Icon = visibilityIcon[v];
            return (
              <label key={v} className="has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-label md:min-h-9">
                <input type="radio" name="call-visibility" className="sr-only" checked={visibility === v} onChange={() => setVisibility(v)} />
                <Icon aria-hidden className="size-4" />
                {visibilityShort[v]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Button type="submit" disabled={!valid || busy} className="h-11 sm:col-span-2 sm:w-fit md:h-9">
        Save call
      </Button>
    </form>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      {children}
    </div>
  );
}
