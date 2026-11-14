"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Check, Heart, Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { BabyName, Parent, PartnerNudge, TalkPrompt } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { duration, ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

// "Tonight, together": what the other parent did lately (GET /together nudge),
// one question to talk about tonight, and the names you both like. Everything
// here is shared between the two parents, never with caregivers.

export function TogetherCard({
  memberId,
  me,
  partner,
  nudge,
  prompts,
  names,
  className,
}: {
  memberId: string;
  me: Parent;
  partner: Parent;
  nudge?: PartnerNudge;
  prompts: TalkPrompt[];
  /** Undefined hides the name list (after birth, or when the endpoint has nothing). */
  names?: BabyName[];
  className?: string;
}) {
  // Closing the nudge hides it at once; the server keeps it closed for this parent.
  const [closed, setClosed] = useState<string>();
  const shown = nudge && nudge.id !== closed ? nudge : undefined;

  async function close(n: PartnerNudge) {
    setClosed(n.id);
    const { error } = await api.POST("/members/{memberId}/nudge-dismissals", { params: { path: { memberId } }, body: { id: n.id } });
    if (error) {
      setClosed(undefined);
      toast.error("Could not close that. Please try again.");
    }
  }

  return (
    <SoftCard tone="them" className={cn("flex flex-col", !shown && "justify-center", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown && (
          <motion.div
            key={shown.id}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.base, ease: ease.out } }}
            className="flex items-start gap-3 rounded-2xl bg-card/65 py-3.5 pr-2 pl-4 text-body"
          >
            <Avatar person={partner} size="sm" className="mt-0.5" />
            <p className="min-w-0 flex-1 py-0.5">{shown.text}</p>
            <button
              type="button"
              aria-label="Close this note"
              onClick={() => close(shown)}
              className="press -my-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-them/40"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* The rest slides up into the nudge's place once it has gone. */}
      <motion.div layout="position" transition={spring.ui}>
        {prompts.length > 0 && <TalkPrompts memberId={memberId} prompts={prompts} first={!shown} />}
        {names && <Names memberId={memberId} me={me} partner={partner} initial={names} />}
      </motion.div>
    </SoftCard>
  );
}

function TalkPrompts({ memberId, prompts, first }: { memberId: string; prompts: TalkPrompt[]; first: boolean }) {
  const [i, setI] = useState(0);
  const [talked, setTalked] = useState<Set<string>>(() => new Set(prompts.filter((p) => p.talkedAt).map((p) => p.id)));
  const [burst, setBurst] = useState(0);
  const prompt = prompts[i % prompts.length];
  const done = talked.has(prompt.id);

  async function markTalked() {
    const id = prompt.id;
    setTalked((s) => new Set(s).add(id));
    setBurst((b) => b + 1);
    const { error } = await api.POST("/members/{memberId}/couple-talks", { params: { path: { memberId } }, body: { promptId: id } });
    if (error) {
      setTalked((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast.error("Could not save that. Please try again.");
    }
  }

  return (
    <div className={cn(first ? "" : "mt-5.5")}>
      <p className="text-caption font-semibold tracking-[0.08em] text-them uppercase">Talk about it tonight</p>
      {/* popLayout: the old question leaves while the new one arrives, in the same spot. */}
      <div className="relative mt-2.5 min-h-[5.5em]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={prompt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="text-headline font-medium text-balance [font-variation-settings:'SOFT'_100,'WONK'_1]"
          >
            {prompt.text}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-4.5 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {done ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring.ui}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4.5 text-label font-semibold text-them"
              >
                <Check aria-hidden className="size-4" />
                You talked about it
              </motion.span>
            ) : (
              <motion.button
                key="todo"
                type="button"
                onClick={markTalked}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.ui}
                className="inline-flex min-h-11 items-center rounded-full bg-them px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-them/40"
              >
                We talked about it
              </motion.button>
            )}
          </AnimatePresence>
          <Celebrate key={burst} on={burst > 0} />
        </div>
        {prompts.length > 1 && (
          <button
            type="button"
            onClick={() => setI((n) => n + 1)}
            className="press inline-flex min-h-11 items-center rounded-full border border-them/35 px-4.5 text-label font-semibold text-them transition-colors duration-(--duration-fast) outline-none hover:bg-card/60 focus-visible:ring-3 focus-visible:ring-them/40"
          >
            Another question
          </button>
        )}
      </div>
    </div>
  );
}

/** A few hearts float up from the button once, when a talk is marked. Playful spring: a small, real milestone. */
function Celebrate({ on }: { on: boolean }) {
  // Hearts are pure movement; under reduced motion the chip's swap says enough.
  const reduce = useReducedMotion();
  if (!on || reduce) return null;
  const hearts = [
    { x: -26, y: -40, r: -14, d: 0, s: 0.9 },
    { x: 6, y: -54, r: 6, d: 0.05, s: 1.1 },
    { x: 34, y: -36, r: 16, d: 0.1, s: 0.8 },
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {hearts.map((h, n) => (
        <motion.span
          key={n}
          className="absolute -mt-2 -ml-2"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.6, rotate: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: h.x, y: h.y, scale: h.s, rotate: h.r }}
          transition={{ ...spring.playful, delay: h.d, opacity: { duration: 0.9, delay: h.d, times: [0, 0.15, 0.7, 1] } }}
        >
          <Heart className="size-4 fill-me-mid text-me-mid" />
        </motion.span>
      ))}
    </span>
  );
}

function Names({ memberId, me, partner, initial }: { memberId: string; me: Parent; partner: Parent; initial: BabyName[] }) {
  const [names, setNames] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const both = names.filter((n) => n.bothLike).slice(0, 5);
  // Names the other parent likes and you have not said yet: one tap to agree.
  const theirs = names.filter((n) => !n.bothLike && n.likedBy.includes(partner.id) && !n.likedBy.includes(me.id)).slice(0, 2);
  const mine = names.filter((n) => !n.bothLike && n.likedBy.includes(me.id) && n.addedBy === me.id).slice(0, 2);

  async function like(n: BabyName) {
    setNames((all) => all.map((x) => (x.id === n.id ? { ...x, likedBy: [...x.likedBy, me.id], bothLike: true } : x)));
    const { data, error } = await api.PUT("/members/{memberId}/baby-names/{nameId}/like", { params: { path: { memberId, nameId: n.id } } });
    if (error) {
      setNames((all) => all.map((x) => (x.id === n.id ? n : x)));
      toast.error("Could not save that. Please try again.");
    } else if (data) setNames((all) => all.map((x) => (x.id === n.id ? data : x)));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    const { data, error, response } = await api.POST("/members/{memberId}/baby-names", { params: { path: { memberId } }, body: { name } });
    if (error) {
      toast.error(response.status === 409 ? `${name} is already on your list.` : "Could not add the name. Please try again.");
      return;
    }
    if (data) setNames((all) => [data, ...all]);
    setValue("");
    setAdding(false);
    toast.success(`${name} is on the list. ${partner.displayName} can like it too.`);
  }

  const chip = "inline-flex min-h-8 items-center rounded-full px-3 font-heading text-[0.9375rem] font-medium [font-variation-settings:'SOFT'_100]";
  return (
    <div className="pt-5.5">
      <ul className="flex flex-wrap items-center gap-2.5 text-label font-normal text-ink-2">
        <li>{both.length > 0 ? "Names you both like" : "Names for the list"}</li>
        <AnimatePresence initial={false}>
          {both.map((n) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.ui} className={cn(chip, "bg-card")}>
              {n.name}
              {n.addedBy === partner.id && (
                <sup className="ml-0.5 font-sans text-[0.625rem] font-semibold text-them" title={`${partner.displayName} added it`}>
                  {partner.displayName.charAt(0)}
                </sup>
              )}
            </motion.li>
          ))}
          {theirs.map((n) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.ui}>
              <button
                type="button"
                onClick={() => like(n)}
                title={`${partner.displayName} likes it. Tap if you do too.`}
                className={cn(chip, "press gap-1.5 border border-dashed border-them/40 text-ink-2 transition-colors duration-(--duration-fast) hover:bg-card")}
              >
                <Heart aria-hidden className="size-3.5 text-them" />
                {n.name}
                <span className="sr-only">, {partner.displayName} likes it. Like it too.</span>
              </button>
            </motion.li>
          ))}
          {mine.map((n) => (
            <motion.li key={n.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.ui} className={cn(chip, "border border-dashed border-line-2 text-ink-2")} title={`Waiting for ${partner.displayName}`}>
              {n.name}
            </motion.li>
          ))}
        </AnimatePresence>
        <li>
          {adding ? (
            <form onSubmit={add} className="flex items-center gap-1.5">
              <input
                ref={input}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                maxLength={60}
                aria-label="A name you like"
                placeholder="A name you like"
                className="h-9 w-36 rounded-full border border-line-2 bg-card px-3 text-body outline-none focus:border-them"
              />
              <button type="submit" className="press inline-flex size-9 items-center justify-center rounded-full bg-them text-white" aria-label="Add the name">
                <Plus aria-hidden className="size-4" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="min-h-8 px-1 text-label font-medium text-them underline decoration-them/40 underline-offset-4 hover:decoration-current"
            >
              Add one
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
