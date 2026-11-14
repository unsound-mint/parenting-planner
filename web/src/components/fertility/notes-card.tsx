"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPen, FlaskConical, Lock, HeartHandshake, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { FertilityEntry, FertilityVisibility } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AudienceChoice } from "./audience-choice";

const starters = ["Day 3 hormone blood test", "Semen analysis", "Pelvic ultrasound", "What the clinic said today"];

type Props = { memberId: string; today: string; mine: string; partnerName?: string; entries: FertilityEntry[] };

/**
 * Fertility tests (done or planned) and notes from the clinic, in one list. Private by
 * default. The author can share or unshare a single item; the partner sees only what is
 * shared and cannot change it.
 */
export function NotesCard({ memberId, today, mine, partnerName, entries }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<"test" | "treatment_note">("test");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<FertilityVisibility>("private");
  const [pending, startTransition] = useTransition();
  const items = entries.filter((e) => e.kind === "test" || e.kind === "treatment_note").sort((a, b) => b.date.localeCompare(a.date));
  const path = { params: { path: { memberId } } };

  function add(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { response } = await api.POST("/members/{memberId}/fertility-entries", { ...path, body: { kind, date, note: note.trim(), visibility } });
      if (!response.ok) {
        toast.error("That did not save. Try again in a moment.");
        return;
      }
      setNote("");
      router.refresh();
    });
  }
  function share(item: FertilityEntry) {
    startTransition(async () => {
      const next: FertilityVisibility = item.visibility === "partner" ? "private" : "partner";
      const { response } = await api.PATCH("/members/{memberId}/fertility-entries/{entryId}", { params: { path: { memberId, entryId: item.id } }, body: { visibility: next } });
      if (response.ok) {
        toast(next === "partner" ? `Shared with ${partnerName}` : "Only you can see it again");
        router.refresh();
      }
    });
  }
  function remove(item: FertilityEntry) {
    startTransition(async () => {
      const { response } = await api.DELETE("/members/{memberId}/fertility-entries/{entryId}", { params: { path: { memberId, entryId: item.id } } });
      if (response.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="notes-title" className="flex min-w-0 flex-col gap-4 rounded-3xl border border-line bg-card p-5.5 md:rounded-[1.75rem] md:p-7">
      <h2 id="notes-title" className="text-title">
        Tests and clinic notes
      </h2>

      <ul className="flex flex-col">
        {items.map((it) => {
          const ours = it.authorId === mine;
          const Icon = it.kind === "test" ? FlaskConical : ClipboardPen;
          return (
            <li key={it.id} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
              <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-label font-normal text-ink">{it.note}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-caption text-muted-foreground">
                  <span>{it.date > today ? `Planned ${formatShortDate(it.date)}` : formatShortDate(it.date)}</span>
                  <span className="inline-flex items-center gap-1">
                    {it.visibility === "partner" ? <HeartHandshake className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
                    {ours ? (it.visibility === "partner" ? `Shared with ${partnerName}` : "Only you") : "Shared with you"}
                  </span>
                </p>
              </div>
              {ours && (
                <div className="flex shrink-0 gap-1">
                  {partnerName && (
                    <button
                      type="button"
                      onClick={() => share(it)}
                      disabled={pending}
                      aria-label={it.visibility === "partner" ? "Stop sharing" : `Share with ${partnerName}`}
                      aria-pressed={it.visibility === "partner"}
                      className={cn("press flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9", it.visibility === "partner" ? "bg-me-soft text-ink" : "text-muted-foreground hover:bg-muted")}
                    >
                      <HeartHandshake className="size-4" aria-hidden />
                    </button>
                  )}
                  <button type="button" onClick={() => remove(it)} disabled={pending} aria-label="Delete" className="press flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={add} className={cn("flex flex-col gap-3", items.length > 0 && "border-t border-line pt-4")}>
        <div role="radiogroup" aria-label="What to add" className="flex gap-2">
          {(
            [
              ["test", "A test", FlaskConical],
              ["treatment_note", "A clinic note", ClipboardPen],
            ] as const
          ).map(([k, label, Icon]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); if (k !== "test" && date > today) setDate(today); }} className={cn("press inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9", kind === k ? "border-ink bg-ink text-paper" : "border-line text-muted-foreground hover:bg-muted")}>
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {starters.map((s) => (
            <button key={s} type="button" onClick={() => setNote(s)} className="press min-h-11 rounded-full bg-muted px-3 text-caption text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8">
              {s}
            </button>
          ))}
        </div>
        <Textarea aria-label="Note" placeholder="What was it, and what did it show?" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-label text-muted-foreground">
            {kind === "test" ? "Date (can be planned)" : "Date"}
            <Input type="date" value={date} max={kind === "test" ? undefined : today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 w-40 md:h-9" />
          </label>
        </div>
        <AudienceChoice value={visibility} onChange={setVisibility} partnerName={partnerName} label="Who can see this note" />
        <Button type="submit" disabled={!note.trim() || pending} className="press h-11 self-start rounded-full px-6 text-label md:h-10">
          Add
        </Button>
      </form>
    </section>
  );
}
