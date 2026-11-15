"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Repeat2 } from "lucide-react";
import type { Mission } from "@/lib/api/types";
import { StickerArt } from "@/components/illustrations";
import { Avatar } from "@/components/joy/partner-chip";
import { ease, spring } from "@/components/joy/motion";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { Person } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Burst } from "@/components/learn/celebrate";
import { finishMission, swapMission, takeMission } from "./actions";

type Props = {
  mission: Mission;
  memberId: string;
  /** Both parents, to name who took or finished it. */
  people: readonly Person[];
  /** Called when the parent puts it back, so a list can offer the next one. */
  onSwapped?: (key: string) => void;
  /** Called after every change (taken, finished) with the new state. */
  onChange?: (mission: Mission) => void;
  className?: string;
};

/** Who a partner mission is meant for. Planning has no one pregnant yet, so it says nothing. */
function partnerLine(stage: Mission["stage"]): string | null {
  switch (stage) {
    case "first_trimester":
    case "second_trimester":
    case "third_trimester":
      return "Meant for the partner who isn't pregnant. Either of you can take it.";
    case "newborn":
    case "baby":
    case "toddler":
      return "Meant for the parent who didn't give birth. Either of you can take it.";
    default:
      return null;
  }
}

const swap = { duration: 0.18, ease: ease.out };
const btn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-label font-semibold press transition-colors duration-(--duration-fast) disabled:opacity-60 md:h-10";

/**
 * One mission: what to do, why it helps, where the advice comes from, and the
 * three things a parent can do with it: take it, finish it with an optional
 * one-line note, or swap it for another. It keeps its own state, so This week
 * can drop it in as is. Never a deadline or a "you missed"; a date, when shown,
 * is when the mission is most useful.
 */
export function MissionCard({ mission, memberId, people, onSwapped, onChange, className }: Props) {
  const [m, setM] = useState(mission);
  const audience = m.forPartner ? partnerLine(m.stage) : null;
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [party, setParty] = useState(0);
  const [failed, setFailed] = useState(false);
  const nameOf = (id?: string) => people.find((p) => p.id === id);
  const taker = nameOf(m.takenBy);
  const doer = nameOf(m.doneBy) ?? taker;
  const mine = m.takenBy === memberId;

  const apply = (next: Mission) => {
    setM(next);
    onChange?.(next);
  };
  const take = () =>
    start(async () => {
      setFailed(false);
      const r = await takeMission(memberId, m.key);
      if (r.ok) apply(r.data);
      else setFailed(true);
    });
  const finish = (withNote: boolean) =>
    start(async () => {
      setFailed(false);
      const r = await finishMission(memberId, m.key, withNote ? note : undefined);
      if (r.ok) {
        apply(r.data);
        setNoting(false);
        setParty((n) => n + 1);
      } else setFailed(true);
    });
  const putBack = () =>
    start(async () => {
      setFailed(false);
      const r = await swapMission(memberId, m.key);
      if (r.ok) onSwapped?.(m.key);
      else setFailed(true);
    });

  const done = m.state === "done";
  return (
    <motion.article
      layout="position"
      transition={spring.ui}
      className={cn("relative flex min-w-0 flex-col gap-3 rounded-3xl p-5.5 md:p-6", done ? "bg-leaf-soft" : "border border-line bg-card", className)}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative size-14 shrink-0 -rotate-3">
          <StickerArt art={`mission_${m.category}`} className="size-full drop-shadow-[0_2px_3px_rgb(43_38_32/0.18)]" />
          {party > 0 && <Burst key={party} colors={["bg-sun", "bg-me", "bg-leaf"]} radius={40} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-title text-balance">{m.title}</h3>
          {audience && !done && <p className="mt-0.5 text-caption text-muted-foreground">{audience}</p>}
        </div>
      </div>
      <p className="text-body text-ink-2">{m.why}</p>

      <div className="mt-auto min-h-11">
        <AnimatePresence mode="popLayout" initial={false}>
          {m.state === "open" && (
            <motion.div key="open" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={swap} className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={take} disabled={pending} className={cn(btn, "bg-me text-white hover:brightness-95")}>
                I will take this
              </button>
              <button type="button" onClick={putBack} disabled={pending} className={cn(btn, "px-3 text-ink-2 hover:bg-muted")} aria-label={`Swap ${m.title} for another mission`}>
                <Repeat2 aria-hidden className="size-4" />
                Swap
              </button>
            </motion.div>
          )}
          {m.state === "taken" && !noting && (
            <motion.div key="taken" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={swap} className="flex flex-wrap items-center gap-2">
              {taker && (
                <span className="mr-1 inline-flex items-center gap-1.5 text-label text-ink-2">
                  <Avatar person={taker} size="sm" />
                  {mine ? "Yours" : `${taker.displayName} has this`}
                  {m.dueOn && <span className="font-mono text-caption text-muted-foreground">· best by {formatShortDate(m.dueOn)}</span>}
                </span>
              )}
              <button type="button" onClick={() => setNoting(true)} disabled={pending} className={cn(btn, "bg-me text-white hover:brightness-95")}>
                <Check aria-hidden className="size-4" />
                We did it
              </button>
              <button type="button" onClick={putBack} disabled={pending} className={cn(btn, "px-3 text-ink-2 hover:bg-muted")} aria-label={`Swap ${m.title} for another mission`}>
                <Repeat2 aria-hidden className="size-4" />
                Swap
              </button>
            </motion.div>
          )}
          {m.state === "taken" && noting && (
            <motion.form
              key="note"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={swap}
              onSubmit={(e) => {
                e.preventDefault();
                finish(true);
              }}
              className="flex flex-col gap-2"
            >
              <label className="text-label text-ink-2" htmlFor={`note-${m.key}`}>
                One line to remember it by (optional)
              </label>
              <input
                id={`note-${m.key}`}
                autoFocus
                value={note}
                maxLength={140}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you make, or how did it go?"
                className="h-11 w-full min-w-0 rounded-2xl border border-line bg-paper px-4 text-body outline-none focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/25 md:h-10"
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={cn(btn, "bg-me text-white hover:brightness-95")}>
                  Save and stick it
                </button>
                <button type="button" onClick={() => finish(false)} disabled={pending} className={cn(btn, "px-3 text-ink-2 hover:bg-muted")}>
                  Skip the note
                </button>
              </div>
            </motion.form>
          )}
          {done && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={swap} className="flex flex-col gap-1.5">
              <p className="inline-flex items-center gap-2 text-label font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-leaf text-white">
                  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                    <motion.path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={party > 0 ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: ease.out, delay: 0.1 }} />
                  </svg>
                </span>
                {doer ? `${doer.displayName} finished this` : "Finished"}
                {m.doneAt && <span className="font-mono text-caption font-normal text-muted-foreground">· {formatLongDate(m.doneAt.slice(0, 10))}</span>}
              </p>
              {m.note && <p className="text-body italic text-ink-2">&ldquo;{m.note}&rdquo;</p>}
            </motion.div>
          )}
        </AnimatePresence>
        {failed && (
          <p role="status" className="mt-2 text-caption text-muted-foreground">
            That did not save. Try again in a moment.
          </p>
        )}
      </div>
    </motion.article>
  );
}
