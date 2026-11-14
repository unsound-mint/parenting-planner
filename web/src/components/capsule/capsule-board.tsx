"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Letter, Parent } from "@/lib/api/types";
import { createLetter, deleteLetter, updateLetter } from "@/app/family/[memberId]/baby/letters/actions";
import { Avatar } from "@/components/joy/partner-chip";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { ease, spring } from "@/components/joy/motion";
import { useFamilyNow } from "@/components/shell/family-clock";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Envelope } from "./envelope";
import { LetterTree } from "./tree";

// Occasions that map to an age; the date is the child's birthday that year (or the due date's).
const OCCASIONS = [
  { label: "First day of school", age: 5 },
  { label: "13th birthday", age: 13 },
  { label: "16th birthday", age: 16 },
  { label: "18th birthday", age: 18 },
  { label: "21st birthday", age: 21 },
] as const;
const OTHER_OCCASIONS = ["Wedding day", "When you become a parent", "A hard day"];
const STARTERS = ["Today you...", "Right now, our days look like...", "What I hope for you is...", "Something I want you to know..."];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addYears = (isoDate: string, years: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return iso(d);
};

function opensIn(opensOn: string, now: Date): string {
  const days = Math.round((Date.parse(`${opensOn}T00:00:00Z`) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000);
  if (days <= 0) return "Ready to open";
  if (days < 60) return `Opens in ${days} ${days === 1 ? "day" : "days"}`;
  if (days < 700) return `Opens in ${Math.round(days / 30.4)} months`;
  return `Opens in ${Math.round(days / 365.25)} years`;
}

type Props = { memberId: string; me: Parent; them?: Parent; childName?: string; childId?: string; origin?: string; initialLetters: Letter[] };

/**
 * Letters to the child, text only. Sealed ones are envelopes with the opening
 * date; the author reads and edits their own, the partner sees that a letter
 * exists and reads it only when the author shared it. The tree grows a leaf per letter.
 */
export function CapsuleBoard({ memberId, me, them, childName, childId, origin, initialLetters }: Props) {
  const now = useFamilyNow();
  const [letters, setLetters] = useState(initialLetters);
  const [openId, setOpenId] = useState<string>();
  const [composing, setComposing] = useState<Letter | "new" | undefined>();
  const [sealed, setSealed] = useState<string>();
  const person = (id: string) => (id === me.id ? me : them);
  const forName = childName ?? "your baby";

  async function save(input: { occasion: string; opensOn: string; body: string; shared: boolean }, existing?: Letter) {
    const body = { occasion: input.occasion, opensOn: input.opensOn, body: input.body, visibility: input.shared ? ("partner" as const) : ("private" as const), ...(childId && !existing ? { childId } : {}) };
    const res = existing ? await updateLetter(memberId, existing.id, body) : await createLetter(memberId, body);
    if (!res.ok) {
      toast.error(res.status === 400 ? "The opening date has to be in the future, and the letter needs some words." : "Could not save the letter. Please try again.");
      return false;
    }
    const saved = res.data;
    setLetters((ls) => [...ls.filter((l) => l.id !== saved.id), saved].sort((a, b) => a.opensOn.localeCompare(b.opensOn)));
    setComposing(undefined);
    if (!existing) {
      setSealed(saved.id);
      toast.success("Sealed. See you on " + formatLongDate(saved.opensOn) + ".");
    } else setOpenId(saved.id);
    return true;
  }

  async function remove(l: Letter) {
    const before = letters;
    setLetters((ls) => ls.filter((x) => x.id !== l.id));
    setOpenId(undefined);
    const res = await deleteLetter(memberId, l.id);
    if (!res.ok) {
      setLetters(before);
      toast.error("Could not delete the letter.");
    }
  }

  const leaves = letters.map((l) => (l.authorId === me.id ? ("me" as const) : ("them" as const)));
  const open = letters.find((l) => l.id === openId);

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero as="section" aria-labelledby="capsule-title" className="grid items-center gap-6 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Baby · time capsule</p>
            <h1 id="capsule-title" className="text-display text-balance">
              Letters {childName ? `to ${childName}` : "to your baby"}, for a day far from now
            </h1>
            <p className="max-w-prose text-body text-ink-2">
              Write one now, choose when it opens, and it waits. You can always read and edit your own. {them ? `${them.displayName} sees that it exists, and its words only if you share it.` : ""}
            </p>
            <div>
              <button
                type="button"
                onClick={() => setComposing("new")}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-me px-5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Plus className="size-4" aria-hidden />
                Write a letter
              </button>
            </div>
          </div>
          <LetterTree leaves={leaves} className="hidden max-w-72 justify-self-end @3xl:block" />
        </SoftCard>
      </Rise>

      <AnimatePresence initial={false}>
        {composing && (
          <motion.div key="composer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.26, ease: ease.out }}>
            <Composer
              key={composing === "new" ? "new" : composing.id}
              existing={composing === "new" ? undefined : composing}
              forName={forName}
              them={them}
              origin={origin}
              now={now}
              onSave={save}
              onCancel={() => setComposing(undefined)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Rise i={1}>
        <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4">
          {letters.map((l, i) => {
            const author = person(l.authorId);
            const mine = l.authorId === me.id;
            const readable = l.body !== undefined;
            const isOpened = opensIn(l.opensOn, now) === "Ready to open";
            return (
              <motion.li key={l.id} layout="position" transition={spring.gentle} className="min-w-0">
                <button
                  type="button"
                  disabled={!readable}
                  aria-expanded={readable ? openId === l.id : undefined}
                  onClick={() => setOpenId(openId === l.id ? undefined : l.id)}
                  className={cn(
                    "lift flex w-full min-w-0 flex-col gap-3 rounded-3xl border border-line bg-card p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                    openId === l.id && "border-me",
                  )}
                >
                  <Envelope tone={mine ? "me" : "them"} opened={false} delay={Math.min(i, 8) * 0.09} seal={sealed === l.id} className="mx-auto max-w-44" />
                  <div className="min-w-0">
                    <p className="text-title text-balance">{l.occasion}</p>
                    <p className="mt-1 font-mono text-caption text-muted-foreground">{formatLongDate(l.opensOn)}</p>
                    <p className="mt-0.5 text-label font-normal text-ink-2">{isOpened ? "Ready to open" : opensIn(l.opensOn, now)}</p>
                  </div>
                  <p className="flex items-center gap-2 text-caption text-muted-foreground">
                    {author && <Avatar person={author} size="sm" />}
                    {mine ? "Yours" : `From ${author?.displayName ?? "your partner"}`}
                    {mine ? (
                      l.visibility === "partner" ? (
                        <span className="ml-auto inline-flex items-center gap-1">
                          <Eye className="size-3.5" aria-hidden />
                          Shared
                        </span>
                      ) : (
                        <span className="ml-auto inline-flex items-center gap-1">
                          <EyeOff className="size-3.5" aria-hidden />
                          Only you
                        </span>
                      )
                    ) : readable ? (
                      <span className="ml-auto inline-flex items-center gap-1">
                        <Eye className="size-3.5" aria-hidden />
                        Shared with you
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1">
                        <Lock className="size-3.5" aria-hidden />
                        Sealed for now
                      </span>
                    )}
                  </p>
                </button>
              </motion.li>
            );
          })}
          {letters.length === 0 && !composing && (
            <li className="rounded-3xl border border-dashed border-line p-6 text-body text-ink-2">Start with the day you would most like to be there for.</li>
          )}
        </ul>
      </Rise>

      <AnimatePresence initial={false}>
        {open && open.body !== undefined && (
          <motion.section
            key={open.id}
            aria-label={`Letter: ${open.occasion}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: ease.out }}
          >
            <SoftCard tone="plain" className="mx-auto flex max-w-2xl flex-col gap-4 bg-sun/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {open.occasion} · {formatLongDate(open.opensOn)}
                  </p>
                  <p className="mt-1 text-label font-normal text-ink-2">
                    Written by {person(open.authorId)?.displayName}
                    {open.authorId !== me.id ? ", shared with you" : ""}
                  </p>
                </div>
                <button type="button" aria-label="Close letter" onClick={() => setOpenId(undefined)} className="press grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <p className="font-heading text-title leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{open.body}</p>
              {open.authorId === me.id && (
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" onClick={() => setComposing(open)} className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4.5 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Pencil className="size-4" aria-hidden />
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(open)} className="press inline-flex min-h-11 items-center gap-2 rounded-full px-4.5 text-label text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </button>
                </div>
              )}
            </SoftCard>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Composer({
  existing,
  forName,
  them,
  origin,
  now,
  onSave,
  onCancel,
}: {
  existing?: Letter;
  forName: string;
  them?: Parent;
  origin?: string;
  now: Date;
  onSave: (input: { occasion: string; opensOn: string; body: string; shared: boolean }, existing?: Letter) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [occasion, setOccasion] = useState(existing?.occasion ?? "");
  const [opensOn, setOpensOn] = useState(existing?.opensOn ?? iso(new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))));
  const [body, setBody] = useState(existing?.body ?? "");
  const [shared, setShared] = useState(existing?.visibility === "partner");
  const [busy, setBusy] = useState(false);
  const tomorrow = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)));
  const dateChanged = !existing || opensOn !== existing.opensOn;
  const valid = occasion.trim() && body.trim() && (!dateChanged || opensOn >= tomorrow);

  return (
    <SoftCard as="section" aria-labelledby="compose-title" className="mx-auto flex max-w-2xl flex-col gap-5">
      <h2 id="compose-title" className="text-headline">
        {existing ? "Edit your letter" : `A letter to ${forName}`}
      </h2>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-label font-semibold">When should it open?</legend>
        <div className="flex flex-wrap gap-2">
          {(origin ? OCCASIONS : []).map((o) => (
            <Chip
              key={o.label}
              on={occasion === o.label}
              onClick={() => {
                setOccasion(o.label);
                setOpensOn(addYears(origin!, o.age));
              }}
            >
              {o.label}
            </Chip>
          ))}
          {OTHER_OCCASIONS.map((o) => (
            <Chip key={o} on={occasion === o} onClick={() => setOccasion(o)}>
              {o}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-label font-normal text-ink-2 @md:max-w-64">
            Occasion
            <input value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={60} className="min-h-11 rounded-xl border border-line bg-card px-3.5 text-body text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
          <label className="flex flex-col gap-1.5 text-label font-normal text-ink-2">
            Opens on
            <input type="date" value={opensOn} min={existing ? undefined : tomorrow} onChange={(e) => setOpensOn(e.target.value)} className="min-h-11 rounded-xl border border-line bg-card px-3.5 font-mono text-body text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
        </div>
      </fieldset>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="letter-body" className="text-label font-semibold">
          Your words
        </label>
        {!body && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Chip key={s} on={false} onClick={() => setBody(s.replace("...", " "))}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <textarea
          id="letter-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={8000}
          rows={9}
          className="min-h-48 rounded-2xl border border-line bg-card p-4 font-heading text-title leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {them && (
        <button type="button" role="switch" aria-checked={shared} onClick={() => setShared(!shared)} className="press flex min-h-11 items-center gap-3 self-start rounded-full text-left text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className={cn("relative h-6 w-10 rounded-full transition-colors duration-200", shared ? "bg-me" : "bg-line")}>
            <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform duration-200", shared && "translate-x-4")} />
          </span>
          {shared ? `${them.displayName} can read this letter` : `Only you can read this letter (${them.displayName} sees that it exists)`}
        </button>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave({ occasion: occasion.trim(), opensOn, body: body.trim(), shared }, existing);
            if (!ok) setBusy(false);
          }}
          className="press min-h-11 rounded-full bg-me px-5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {existing ? "Save changes" : "Seal the letter"}
        </button>
        <button type="button" onClick={onCancel} className="press min-h-11 rounded-full px-4.5 text-label text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Cancel
        </button>
      </div>
    </SoftCard>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("press min-h-11 rounded-full border px-4 text-label outline-none focus-visible:ring-3 focus-visible:ring-ring/50", on ? "border-me bg-me-soft font-semibold" : "border-line bg-card")}
    >
      {children}
    </button>
  );
}
