"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CareLogEntry, CareLogEntryInput, DiaperContent, FeedMethod } from "@/lib/api/types";
import { breastSide, fromEasternInput, toEasternInput } from "@/lib/care";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { careLogIcon, careLogLabel, careLogTint } from "@/lib/visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Side = "left" | "right" | "both";
const sideMethod: Record<Side, FeedMethod> = { left: "breast_left", right: "breast_right", both: "breast_both" };

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-muted p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "min-h-9 flex-1 rounded-lg px-3 text-label whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === v ? "bg-card font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const field = "flex flex-col gap-1.5";
const input = "h-11 rounded-xl bg-card px-3 text-body";

/**
 * Correct or remove one logged entry, opened from the day chart. A feed is a
 * breastfeed (side and, if timed, its length) or a bottle (milk and amount);
 * a sleep has a start and an end, or is still going.
 */
export function EntryEditor({ memberId, entry, author, onClose }: { memberId: string; entry: CareLogEntry; author?: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(toEasternInput(entry.startedAt));
  const [end, setEnd] = useState(entry.endedAt ? toEasternInput(entry.endedAt) : "");
  const side0 = breastSide(entry);
  const [method, setMethod] = useState<"breast" | "bottle">(entry.kind === "feed" && !side0 ? "bottle" : "breast");
  const [side, setSide] = useState<Side>(side0 ?? "left");
  const [milk, setMilk] = useState<FeedMethod>(entry.feedMethod === "bottle_formula" ? "bottle_formula" : "bottle_breast_milk");
  const [minutes, setMinutes] = useState(entry.kind === "feed" && entry.endedAt ? String(Math.round((Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 60_000)) : "");
  const [amount, setAmount] = useState(entry.amountMl ? String(entry.amountMl) : "");
  const [diaper, setDiaper] = useState<DiaperContent>(entry.diaper ?? "wet");
  const [note, setNote] = useState(entry.note ?? "");
  const Icon = careLogIcon[entry.kind];

  function body(): CareLogEntryInput | string {
    if (!start) return "Pick when it started.";
    const startedAt = fromEasternInput(start);
    const b: CareLogEntryInput = { kind: entry.kind, childId: entry.childId, startedAt, note: note.trim() || undefined };
    if (entry.kind === "sleep" && end) {
      b.endedAt = fromEasternInput(end);
      if (Date.parse(b.endedAt) < Date.parse(startedAt)) return "The end is before the start.";
    }
    if (entry.kind === "feed") {
      if (method === "breast") {
        b.feedMethod = sideMethod[side];
        const m = Number(minutes);
        if (minutes && (!Number.isFinite(m) || m <= 0 || m > 180)) return "A feed lasts between 1 and 180 minutes.";
        if (m > 0) b.endedAt = new Date(Date.parse(startedAt) + m * 60_000).toISOString();
      } else {
        b.feedMethod = milk;
        const a = Number(amount);
        if (amount && (!Number.isInteger(a) || a <= 0 || a > 400)) return "The amount is between 1 and 400 ml.";
        if (a > 0) b.amountMl = a;
      }
    }
    if (entry.kind === "diaper") b.diaper = diaper;
    return b;
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const b = body();
    if (typeof b === "string") {
      toast.error(b);
      return;
    }
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/care-log/{entryId}", { params: { path: { memberId, entryId: entry.id } }, body: b });
      if (error) {
        toast.error(error.message ?? "Could not save. Please try again.");
        return;
      }
      toast.success(`${careLogLabel[entry.kind]} updated`);
      onClose();
      router.refresh();
    });
  }

  function remove() {
    const again: CareLogEntryInput = {
      kind: entry.kind,
      childId: entry.childId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      feedMethod: entry.feedMethod,
      amountMl: entry.amountMl,
      diaper: entry.diaper,
      note: entry.note,
    };
    startTransition(async () => {
      const { error } = await api.DELETE("/members/{memberId}/care-log/{entryId}", { params: { path: { memberId, entryId: entry.id } } });
      if (error) {
        toast.error(error.message ?? "Could not remove it. Please try again.");
        return;
      }
      onClose();
      router.refresh();
      toast(`${careLogLabel[entry.kind]} at ${formatClock(entry.startedAt)} removed`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await api.POST("/members/{memberId}/care-log", { params: { path: { memberId } }, body: again });
            router.refresh();
          },
        },
      });
    });
  }

  return (
    <form onSubmit={save} aria-labelledby="edit-entry-title" className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", careLogTint[entry.kind].soft)}>
          <Icon aria-hidden className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="edit-entry-title" className="text-title">
            {careLogLabel[entry.kind]} at {formatClock(entry.startedAt)}
          </h3>
          {author && <p className="text-caption text-muted-foreground">Logged by {author}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="press flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-4">
        <div className={field}>
          <Label htmlFor="entry-start">{entry.kind === "sleep" ? "Fell asleep" : "Time"}</Label>
          <Input id="entry-start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </div>
        {entry.kind === "sleep" && (
          <div className={field}>
            <Label htmlFor="entry-end">Woke up</Label>
            <Input id="entry-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
            {!end && <p className="text-caption text-muted-foreground">Empty while still asleep</p>}
          </div>
        )}
        {entry.kind === "feed" && (
          <>
            <div className={field}>
              <span className="text-label font-medium">How</span>
              <Segmented label="How" value={method} onChange={setMethod} options={[["breast", "Breast"], ["bottle", "Bottle"]]} />
            </div>
            {method === "breast" ? (
              <>
                <div className={field}>
                  <span className="text-label font-medium">Side</span>
                  <Segmented label="Side" value={side} onChange={setSide} options={[["left", "Left"], ["right", "Right"], ["both", "Both"]]} />
                </div>
                <div className={field}>
                  <Label htmlFor="entry-minutes">Minutes (optional)</Label>
                  <Input id="entry-minutes" type="number" inputMode="numeric" min={1} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={cn(input, "font-mono")} />
                </div>
              </>
            ) : (
              <>
                <div className={field}>
                  <span className="text-label font-medium">Milk</span>
                  <Segmented label="Milk" value={milk} onChange={setMilk} options={[["bottle_breast_milk", "Breast milk"], ["bottle_formula", "Formula"]]} />
                </div>
                <div className={field}>
                  <Label htmlFor="entry-amount">Amount in ml (optional)</Label>
                  <Input id="entry-amount" type="number" inputMode="numeric" min={1} max={400} value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(input, "font-mono")} />
                </div>
              </>
            )}
          </>
        )}
        {entry.kind === "diaper" && (
          <div className={field}>
            <span className="text-label font-medium">What was in it</span>
            <Segmented label="What was in it" value={diaper} onChange={setDiaper} options={[["wet", "Wet"], ["dirty", "Dirty"], ["both", "Both"]]} />
          </div>
        )}
        <div className={cn(field, "@3xl:col-span-2 @6xl:col-span-4")}>
          <Label htmlFor="entry-note">Note (optional)</Label>
          <Input id="entry-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Spit up a little, fussy at the end" className={input} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending} className="press h-11 rounded-full px-5 text-label">
          Save changes
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={remove} className="press ml-auto h-11 gap-2 rounded-full px-4 text-label text-muted-foreground hover:text-foreground">
          <Trash2 aria-hidden className="size-4" />
          Remove
        </Button>
      </div>
    </form>
  );
}
