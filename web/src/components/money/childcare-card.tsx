"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, ListOrdered, PiggyBank, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { ChildcareKind, ChildcareList, ChildcareOption, ChildcareOptionInput, ChildcareStatus } from "@/lib/api/types";
import { daysUntil, formatShortDate, whenWords } from "@/lib/format";
import { childcareKindMeta, childcareStatuses, childcareStatusLabel, dollars, toCents, toDollarsField } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { GrowBar } from "./motion";

const field = "h-11 w-full min-w-0 rounded-xl border border-line-2 bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-label";

const starters: { label: string; kind: ChildcareKind }[] = [
  { label: "A daycare center", kind: "center" },
  { label: "A home daycare", kind: "home_based" },
  { label: "A nanny", kind: "nanny" },
  { label: "Grandparents helping", kind: "family" },
];

const statusTone: Record<ChildcareStatus, string> = {
  inquiring: "bg-muted text-ink-2",
  toured: "bg-status-up-soft text-status-up",
  waitlisted: "bg-status-due-soft text-status-due",
  applied: "bg-status-up-soft text-status-up",
  accepted: "bg-status-ok-soft text-status-ok",
  declined: "bg-muted text-muted-foreground",
};

/** Daycares and other arrangements: cost against a typical range, deadline countdown, waitlist place. */
export function ChildcareCard({ memberId, initial, today, budgetNames }: { memberId: string; initial: ChildcareList; today: string; budgetNames: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChildcareKind | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set(budgetNames));
  const path = { params: { path: { memberId } } };
  const now = new Date(`${today}T00:00:00Z`);
  const { lowMonthlyCents: low, highMonthlyCents: high } = list.benchmark;

  async function reload() {
    const { data } = await api.GET("/members/{memberId}/childcare-options", path);
    if (data) setList(data);
  }

  async function save(body: ChildcareOptionInput, id?: string) {
    const res = id
      ? await api.PUT("/members/{memberId}/childcare-options/{optionId}", { params: { path: { memberId, optionId: id } }, body })
      : await api.POST("/members/{memberId}/childcare-options", { ...path, body });
    if (res.error) {
      toast.error("Could not save that. Please try again.");
      return;
    }
    await reload();
    setEditing(null);
    setDraft(null);
  }

  async function remove(id: string) {
    const { error } = await api.DELETE("/members/{memberId}/childcare-options/{optionId}", { params: { path: { memberId, optionId: id } } });
    if (error) toast.error("Could not remove that.");
    else await reload();
  }

  async function addToBudget(o: ChildcareOption) {
    const name = `Childcare: ${o.name}`;
    const { error } = await api.POST("/members/{memberId}/budget-items", {
      ...path,
      body: { category: "childcare", name, amountCents: o.monthlyCostCents ?? 0, cadence: "monthly", payer: "shared" },
    });
    if (error) {
      toast.error("Could not add it to the budget.");
      return;
    }
    setAdded((s) => new Set(s).add(name));
    toast.success("Added to your budget.");
    router.refresh();
  }

  return (
    <SoftCard as="section" aria-labelledby="care-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="care-title" className="text-title">
            Who will look after the baby
          </h2>
          <p className="mt-1 text-label text-muted-foreground">
            An estimate: full-day care for one child typically runs <span className="font-mono text-ink-2">{dollars(low)}</span> to{" "}
            <span className="font-mono text-ink-2">{dollars(high)}</span> a month.
          </p>
        </div>
        <Link href={`/family/${memberId}/calendar`} className="inline-flex min-h-11 items-center gap-1.5 text-label text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink md:min-h-0">
          <CalendarClock aria-hidden className="size-4" />
          Deadlines show on the calendar
        </Link>
      </div>

      <ul className="grid gap-4 @4xl:grid-cols-2 @7xl:grid-cols-3">
        {list.items.map((o) => {
          const meta = childcareKindMeta[o.kind];
          const days = o.applicationDeadline ? daysUntil(o.applicationDeadline, now) : null;
          const open = o.status === "inquiring" || o.status === "toured" || o.status === "waitlisted";
          const soon = open && days !== null && days <= 14;
          const budgetName = `Childcare: ${o.name}`;
          if (editing === o.id) {
            return (
              <li key={o.id} className="col-span-full">
                <OptionForm option={o} onSave={(b) => save(b, o.id)} onCancel={() => setEditing(null)} onDelete={() => void remove(o.id)} />
              </li>
            );
          }
          return (
            <li key={o.id} className={cn("flex flex-col gap-3 rounded-2xl bg-muted p-4", o.status === "declined" && "opacity-70")}>
              <button type="button" onClick={() => setEditing(o.id)} className="press -m-1 flex items-start gap-3 rounded-xl p-1 text-left" aria-label={`Edit ${o.name}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-ink-2">
                  <meta.icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-title">{o.name}</span>
                  <span className="block text-label text-muted-foreground">{meta.label}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-caption font-medium", statusTone[o.status])}>{childcareStatusLabel[o.status]}</span>
              </button>

              {o.monthlyCostCents != null && (
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-body">{dollars(o.monthlyCostCents)}</span>
                    <span className="text-caption text-muted-foreground">a month</span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-card" role="img" aria-label={`${dollars(o.monthlyCostCents)} a month, typical range ${dollars(low)} to ${dollars(high)}`}>
                    <GrowBar ratio={Math.min(1, o.monthlyCostCents / Math.max(high, o.monthlyCostCents))} className="bg-primary/80" />
                    <span aria-hidden className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-ink/50" style={{ left: `${(high / Math.max(high, o.monthlyCostCents)) * 100}%` }} />
                  </div>
                </div>
              )}

              <ul className="flex flex-wrap gap-2 text-label">
                {days !== null && o.applicationDeadline && open && (
                  <li className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1", soon ? "bg-status-due-soft text-status-due" : "bg-card text-ink-2")}>
                    <CalendarClock aria-hidden className="size-3.5" />
                    <span>
                      Apply by <span className="font-mono">{formatShortDate(o.applicationDeadline)}</span>, {days < 0 ? "passed" : whenWords(days)}
                    </span>
                  </li>
                )}
                {o.waitlistPosition != null && (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-ink-2">
                    <ListOrdered aria-hidden className="size-3.5" />
                    <span className="font-mono">#{o.waitlistPosition}</span> on the list
                  </li>
                )}
              </ul>
              {o.notes && <p className="text-label text-ink-2">{o.notes}</p>}
              {o.contact && <p className="font-mono text-caption text-muted-foreground">{o.contact}</p>}
              {o.monthlyCostCents != null && o.status !== "declined" && (
                <button
                  type="button"
                  disabled={added.has(budgetName)}
                  onClick={() => void addToBudget(o)}
                  className="press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border border-line-2 bg-card px-3 text-label text-ink-2 disabled:opacity-60 md:min-h-9"
                >
                  <PiggyBank aria-hidden className="size-4" />
                  {added.has(budgetName) ? "In the budget" : "Add to the budget"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {draft ? (
        <OptionForm kind={draft} onSave={(b) => save(b)} onCancel={() => setDraft(null)} />
      ) : (
        <div>
          <p className="mb-2 text-label text-muted-foreground">{list.items.length === 0 ? "Start with the one you hear about most." : "Another one to keep track of?"}</p>
          <ul className="flex flex-wrap gap-2">
            {starters.map((s) => (
              <li key={s.kind}>
                <button type="button" onClick={() => setDraft(s.kind)} className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 text-label text-ink-2 hover:bg-muted md:min-h-9">
                  <Plus aria-hidden className="size-3.5" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SourceLine sources={[list.benchmark.source]} />
    </SoftCard>
  );
}

function OptionForm({
  option,
  kind,
  onSave,
  onCancel,
  onDelete,
}: {
  option?: ChildcareOption;
  kind?: ChildcareKind;
  onSave: (b: ChildcareOptionInput) => Promise<unknown>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(option?.name ?? "");
  const [k, setK] = useState<ChildcareKind>(option?.kind ?? kind ?? "center");
  const [status, setStatus] = useState<ChildcareStatus>(option?.status ?? "inquiring");
  const [cost, setCost] = useState(option?.monthlyCostCents != null ? toDollarsField(option.monthlyCostCents) : "");
  const [deadline, setDeadline] = useState(option?.applicationDeadline ?? "");
  const [waitlist, setWaitlist] = useState(option?.waitlistPosition != null ? String(option.waitlistPosition) : "");
  const [contact, setContact] = useState(option?.contact ?? "");
  const [notes, setNotes] = useState(option?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        const c = toCents(cost);
        const w = parseInt(waitlist, 10);
        await onSave({
          name: name.trim(),
          kind: k,
          status,
          monthlyCostCents: cost.trim() ? c : undefined,
          applicationDeadline: deadline || undefined,
          waitlistPosition: Number.isFinite(w) && w >= 1 ? w : undefined,
          contact: contact.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        setBusy(false);
      }}
      className="rise flex flex-col gap-3 rounded-2xl bg-muted p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input aria-label="Name" placeholder="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} />
        <select aria-label="Kind" value={k} onChange={(e) => setK(e.target.value as ChildcareKind)} className={field}>
          {(Object.keys(childcareKindMeta) as ChildcareKind[]).map((x) => (
            <option key={x} value={x}>
              {childcareKindMeta[x].label}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ChildcareStatus)} className={field}>
          {childcareStatuses.map((x) => (
            <option key={x} value={x}>
              {childcareStatusLabel[x]}
            </option>
          ))}
        </select>
        <input aria-label="Monthly cost in dollars" inputMode="numeric" placeholder="Monthly cost, $" value={cost} onChange={(e) => setCost(e.target.value)} className={cn(field, "font-mono")} />
        <label className="block text-caption text-muted-foreground">
          Application deadline
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={cn(field, "mt-1 font-mono")} />
        </label>
        <label className="block text-caption text-muted-foreground">
          Place on the waitlist
          <input inputMode="numeric" value={waitlist} onChange={(e) => setWaitlist(e.target.value)} className={cn(field, "mt-1 font-mono")} />
        </label>
      </div>
      <input aria-label="Contact" placeholder="Who to call or email" value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} className={field} />
      <textarea aria-label="Notes" placeholder="What you noticed on the visit" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(field, "h-auto py-2")} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || !name.trim()} className="press min-h-11 rounded-full bg-primary px-5 text-label font-medium text-primary-foreground disabled:opacity-50 md:min-h-9">
          {option ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="press inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-label text-muted-foreground hover:text-ink md:min-h-9">
          <X aria-hidden className="size-4" />
          Cancel
        </button>
        <span className="flex-1" />
        {onDelete && (
          <button type="button" onClick={onDelete} aria-label={`Remove ${option?.name}`} className="press grid size-11 place-items-center rounded-full text-muted-foreground hover:text-status-late md:size-9">
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
