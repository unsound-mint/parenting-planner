"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Hourglass, Send } from "lucide-react";
import type { LabCard, Parent } from "@/lib/api/types";
import { saveLabAnswer, saveLabTalk } from "@/app/family/[memberId]/learn/lab/actions";
import { Avatar } from "@/components/joy/partner-chip";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { LabArt } from "./lab-art";
import { RevealedCard } from "./reveal";

type Choice = "a" | "b" | "c" | "d" | "other";

const TOPICS = ["Night shifts", "Relatives and visits", "Childcare", "Parenting values", "Money", "You two"] as const;
// The catalog says "Relatives and visits"; the chip says it shorter.
const short: Record<string, string> = { "Relatives and visits": "Relatives" };

/**
 * The lab's one screen. A card to answer on your own (your partner's answer is
 * never in the page until you answered), the cards you both answered turned
 * face up, and the ones waiting for one of you. No score and no percentage:
 * the dots under each topic only show who answered.
 */
export function LabBoard({ memberId, me, them, initialCards }: { memberId: string; me: Parent; them: Parent; initialCards: LabCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // The card just answered stays on screen (locked in or turning over) until "Next card".
  const [justId, setJustId] = useState<string>();
  const [talkedBy, setTalkedBy] = useState<Record<string, string>>({});

  const mineOpen = cards.filter((c) => !c.mine);
  // A card the partner already answered goes first: they are waiting on you.
  const queue = [...mineOpen.filter((c) => c.partnerAnswered), ...mineOpen.filter((c) => !c.partnerAnswered)];
  const just = cards.find((c) => c.id === justId);
  const current = just ?? queue[0];
  const revealed = cards.filter((c) => c.reveal);
  const talks = revealed.filter((c) => !c.reveal!.agree);
  const agrees = revealed.filter((c) => c.reveal!.agree);
  const waiting = cards.filter((c) => c.mine && !c.reveal);

  async function answer(card: LabCard, choice: Choice, text?: string) {
    const res = await saveLabAnswer(memberId, card.id, choice, text);
    if (!res.ok) {
      toast.error(res.status === 409 ? "You both already answered that one." : "Could not save your answer. Please try again.");
      return false;
    }
    const next = res.data;
    setCards((cs) => cs.map((c) => (c.id === next.id ? next : c)));
    if (next.reveal) setFresh((f) => new Set(f).add(next.id));
    setJustId(next.id);
    return true;
  }

  async function talked(card: LabCard) {
    const id = card.reveal!.talkPrompt.id;
    const stamp = new Date().toISOString();
    const set = (talkedAt?: string) =>
      setCards((cs) => cs.map((c) => (c.id === card.id && c.reveal ? { ...c, reveal: { ...c.reveal, talkPrompt: { ...c.reveal.talkPrompt, talkedAt, talkedBy: talkedAt ? me.id : undefined } } } : c)));
    set(stamp);
    const res = await saveLabTalk(memberId, id);
    if (res.ok) setTalkedBy((t) => ({ ...t, [card.id]: res.data.talkedBy }));
    else {
      set(undefined);
      toast.error("Could not save that. Please try again.");
    }
  }

  const by = (c: LabCard) => {
    const id = c.reveal?.talkPrompt.talkedBy ?? talkedBy[c.id];
    return id === them.id ? them : id === me.id ? me : undefined;
  };
  const answeredBy = (who: "me" | "them") => cards.filter((c) => (who === "me" ? c.mine : c.partnerAnswered)).length;

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero as="section" aria-labelledby="lab-title" className="grid items-center gap-6 @3xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">Learn · for the two of you</p>
            <h1 id="lab-title" className="text-display text-balance">
              Things worth talking about, before they come up at 2 a.m.
            </h1>
            <p className="max-w-prose text-body text-ink-2">
              Answer each short scenario on your own. {them.displayName}&apos;s answer stays hidden until you have both answered it. Then you see where you already agree and where a conversation helps. There is no score.
            </p>
            <ul className="mt-1 flex flex-wrap gap-2" aria-label="Topics">
              {TOPICS.map((t) => {
                const of = cards.filter((c) => c.topic === t);
                if (of.length === 0) return null;
                return (
                  <li key={t} className="flex items-center gap-2.5 rounded-full bg-card/80 py-1.5 pr-3.5 pl-3 text-caption font-semibold text-ink-2">
                    {short[t] ?? t}
                    <span className="flex gap-1" aria-label={`${of.filter((c) => c.mine).length} of ${of.length} answered by you`}>
                      {of.map((c) => (
                        <span key={c.id} className={cn("size-2 rounded-full transition-colors duration-300", c.reveal ? "bg-leaf" : c.mine ? "bg-me" : "bg-line")} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <LabArt className="hidden max-w-64 justify-self-end @3xl:block" />
        </SoftCard>
      </Rise>

      <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] @7xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <Rise i={1} className="flex min-w-0 flex-col gap-4 @5xl:sticky @5xl:top-4">
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24, ease: ease.out }}>
                <Question key={current.id} card={current} them={them} onAnswer={answer} locked={!!just} onNext={() => setJustId(undefined)} hasNext={queue.filter((c) => c.id !== current.id).length > 0} />
              </motion.div>
            ) : (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: ease.out }}>
                <SoftCard tone="leaf" className="flex flex-col gap-2">
                  <h2 className="text-headline">You have answered every card.</h2>
                  <p className="text-body text-ink-2">{waiting.length > 0 ? `${them.displayName} still has ${waiting.length === 1 ? "one" : waiting.length} to go. Those cards turn over as soon as they answer.` : "Pick a conversation from the cards and take it to your next walk or dinner."}</p>
                </SoftCard>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Avatar person={me} size="sm" /> {answeredBy("me")} answered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Avatar person={them} size="sm" /> {answeredBy("them")} answered
            </span>
          </p>
        </Rise>

        <Rise i={2} className="flex min-w-0 flex-col gap-8">
          {talks.length > 0 && (
            <section aria-labelledby="talk-h" className="flex flex-col gap-4">
              <div>
                <h2 id="talk-h" className="text-headline">
                  Worth a conversation
                </h2>
                <p className="mt-1 text-label font-normal text-muted-foreground">You answered these differently. That is useful to know now, not a problem.</p>
              </div>
              <ul className="grid gap-4">
                {talks.map((c) => (
                  <RevealedCard key={c.id} card={c} me={me} them={them} fresh={fresh.has(c.id)} talkedBy={by(c)} onTalked={() => talked(c)} />
                ))}
              </ul>
            </section>
          )}
          {agrees.length > 0 && (
            <section aria-labelledby="agree-h" className="flex flex-col gap-4">
              <h2 id="agree-h" className="text-headline">
                You are on the same page
              </h2>
              <ul className="grid gap-4 @3xl:grid-cols-2">
                {agrees.map((c) => (
                  <RevealedCard key={c.id} card={c} me={me} them={them} fresh={fresh.has(c.id)} onTalked={() => {}} />
                ))}
              </ul>
            </section>
          )}
          {waiting.length > 0 && (
            <section aria-labelledby="wait-h" className="flex flex-col gap-3">
              <h2 id="wait-h" className="text-headline">
                Waiting for {them.displayName}
              </h2>
              <ul className="grid gap-2.5">
                {waiting.map((c) => (
                  <motion.li key={c.id} layout="position" transition={spring.gentle} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3.5 text-label">
                    <Hourglass className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 text-balance">{c.situation}</span>
                    <span className="shrink-0 text-caption text-muted-foreground">{c.topic}</span>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}
        </Rise>
      </div>
    </>
  );
}

function Question({ card, them, onAnswer, locked, onNext, hasNext }: { card: LabCard; them: Parent; onAnswer: (c: LabCard, choice: Choice, text?: string) => Promise<boolean>; locked: boolean; onNext: () => void; hasNext: boolean }) {
  const [picked, setPicked] = useState<Choice>();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = card.mine?.choiceId ?? picked;

  async function pick(choice: Choice) {
    if (locked || busy) return;
    if (choice === "other") return setPicked("other");
    setPicked(choice);
    setBusy(true);
    if (!(await onAnswer(card, choice))) setPicked(undefined);
    setBusy(false);
  }

  async function sendOther() {
    setBusy(true);
    await onAnswer(card, "other", text.trim());
    setBusy(false);
  }

  return (
    <SoftCard as="section" aria-labelledby={`q-${card.id}`} className="flex flex-col gap-4">
      <p className="flex items-center justify-between gap-3 text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {card.topic}
        {!locked && card.partnerAnswered && <span className="rounded-full bg-them-soft px-2.5 py-0.5 text-them normal-case tracking-normal">{them.displayName} answered this one</span>}
      </p>
      <h2 id={`q-${card.id}`} className="text-headline text-balance">
        {card.situation}
      </h2>
      <div role="radiogroup" aria-labelledby={`q-${card.id}`} className="flex flex-col gap-2.5">
        {card.choices.map((ch) => (
          <ChoiceButton key={ch.id} selected={mine === ch.id} disabled={locked} onClick={() => pick(ch.id)}>
            {ch.label}
          </ChoiceButton>
        ))}
        <ChoiceButton selected={mine === "other"} disabled={locked} onClick={() => pick("other")}>
          {locked && card.mine?.otherText ? card.mine.otherText : "Something else"}
        </ChoiceButton>
      </div>
      <AnimatePresence initial={false}>
        {picked === "other" && !locked && (
          <motion.form
            key="other"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: ease.out }}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void sendOther();
            }}
            className="flex flex-col gap-2.5"
          >
            <label htmlFor={`o-${card.id}`} className="text-label font-normal text-ink-2">
              In your words
            </label>
            <textarea
              id={`o-${card.id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              rows={3}
              autoFocus
              className="min-h-24 resize-none rounded-2xl border border-line bg-card p-3.5 text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button type="submit" disabled={!text.trim() || busy} className="press inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-me px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50">
              <Send className="size-4" aria-hidden />
              Lock in my answer
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {locked && (
          <motion.div key="locked" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.ui} className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
            <p className="text-body">{card.reveal ? "You both answered, so the card just turned over." : `Locked in. ${them.displayName} has not answered this one yet, so it stays hidden until they do.`}</p>
            <button type="button" onClick={onNext} className="press inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-me px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {hasNext ? "Next card" : "Done for now"}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </SoftCard>
  );
}

function ChoiceButton({ selected, disabled, onClick, children }: { selected: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press min-h-12 rounded-2xl border px-4 py-3 text-left text-body text-balance outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-me bg-me-soft font-semibold" : "border-line bg-card hover:bg-muted disabled:hover:bg-card",
        disabled && !selected && "opacity-60",
      )}
    >
      {children}
    </button>
  );
}
