"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, Heart, Lock, Plus, Sparkles, Trophy, Undo2 } from "lucide-react";
import type { NameCard, NameDeck as Deck, NamesQuest, NameSex, NameVerdict, Parent } from "@/lib/api/types";
import { api } from "@/lib/api/client";
import { Avatar } from "@/components/joy/partner-chip";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { Burst } from "@/components/learn/celebrate";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { NameDeck } from "./name-deck";
import { NameTrend } from "./name-trend";
import { fmt, listTitles, popularity, rankWords, stageInfo, verdictLabel, type Popularity } from "./model";

// The names quest: pick lists, each parent swipes on their own, names both
// love become the shortlist, five matches open a head-to-head final round that
// ends in the couple's top three. Everything is read back from the API; the
// other parent's answer on a name is never shown before you answered it (the
// API enforces it; the deck carries no verdicts at all).

type Couple = { me: Parent; them?: Parent };
type Last = { card: NameCard; verdict: NameVerdict };

export function NamesQuestBoard({ memberId, couple, initialQuest, initialDeck }: { memberId: string; couple: Couple; initialQuest: NamesQuest; initialDeck: Deck }) {
  const [quest, setQuest] = useState(initialQuest);
  const [deck, setDeck] = useState(initialDeck.items);
  const [remaining, setRemaining] = useState(initialDeck.remaining);
  const [sex, setSex] = useState<NameSex | "any">("any");
  const [pop, setPop] = useState<Popularity>("any");
  const [match, setMatch] = useState<NameCard | null>(null);
  const [last, setLast] = useState<Last | null>(null);
  const [, startTransition] = useTransition();
  const path = { memberId };
  const answered = useRef(new Set<string>());

  const loadDeck = useCallback(
    async (s: NameSex | "any", p: Popularity) => {
      const { data } = await api.GET("/members/{memberId}/names-quest/deck", {
        params: { path: { memberId }, query: { sex: s === "any" ? undefined : s, minBabies: popularity[p].min, maxBabies: popularity[p].max } },
      });
      if (!data) return;
      setDeck(data.items.filter((c) => !answered.current.has(c.name)));
      setRemaining(data.remaining);
    },
    [memberId],
  );

  const refreshQuest = useCallback(async () => {
    const { data } = await api.GET("/members/{memberId}/names-quest", { params: { path: { memberId } } });
    if (data) setQuest(data);
  }, [memberId]);

  const answer = (card: NameCard, verdict: NameVerdict) => {
    answered.current.add(card.name);
    setDeck((d) => d.filter((c) => c.name !== card.name));
    setRemaining((r) => Math.max(0, r - 1));
    setLast({ card, verdict });
    setMatch(null);
    startTransition(async () => {
      const { data } = await api.POST("/members/{memberId}/names-quest/swipes", { params: { path }, body: { name: card.name, verdict } });
      if (data?.match) setMatch(data.card ?? card);
      await refreshQuest();
      if (deck.length <= 4) await loadDeck(sex, pop);
    });
  };

  const undo = () => {
    if (!last) return;
    const { card } = last;
    setLast(null);
    setMatch(null);
    answered.current.delete(card.name);
    setDeck((d) => [card, ...d.filter((c) => c.name !== card.name)]);
    setRemaining((r) => r + 1);
    startTransition(async () => {
      await api.DELETE("/members/{memberId}/names-quest/swipes/{name}", { params: { path: { memberId, name: card.name } } });
      await refreshQuest();
    });
  };

  const filter = (s: NameSex | "any", p: Popularity) => {
    setSex(s);
    setPop(p);
    startTransition(() => loadDeck(s, p));
  };

  const toggleList = (id: string) => {
    const chosen = quest.chosen.includes(id) ? quest.chosen.filter((l) => l !== id) : [...quest.chosen, id];
    if (chosen.length === 0) return;
    setQuest((q) => ({ ...q, chosen }));
    startTransition(async () => {
      const { data } = await api.PUT("/members/{memberId}/names-quest/lists", { params: { path }, body: { lists: chosen } });
      if (data) setQuest(data);
      await loadDeck(sex, pop);
    });
  };

  const judge = (winner: NameCard, loser: NameCard) => {
    if (!winner.id || !loser.id) return;
    startTransition(async () => {
      const { data } = await api.POST("/members/{memberId}/names-quest/duels", { params: { path }, body: { winnerId: winner.id!, loserId: loser.id! } });
      if (data) setQuest(data);
    });
  };

  const addName = async (name: string) => {
    const { data } = await api.POST("/members/{memberId}/baby-names", { params: { path }, body: { name } });
    if (data) await refreshQuest();
    return Boolean(data);
  };

  const mine = quest.progress.find((p) => p.memberId === memberId);
  const theirs = quest.progress.find((p) => p.memberId !== memberId);
  const unlocked = quest.pairCount > 0;

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-6">
        <QuestProgress quest={quest} couple={couple} mine={mine?.swiped ?? 0} theirs={theirs?.swiped} />

        <div className="grid min-w-0 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @7xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,26rem)]">
          <section aria-labelledby="deck-title" className="flex min-w-0 flex-col gap-4 @4xl:col-start-1 @4xl:row-start-1 @7xl:col-start-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="deck-title" className="text-title">
                Your deck
              </h2>
              <p className="font-mono text-caption text-muted-foreground">{fmt(remaining)} left</p>
            </div>
            <div className="relative">
              {deck.length > 0 ? (
                <NameDeck cards={deck} quest={quest} partnerName={couple.them?.displayName} onAnswer={answer} />
              ) : (
                <DeckDone pop={pop} sex={sex} onWiden={() => filter("any", "any")} />
              )}
              <AnimatePresence>{match && <MatchCelebration key={match.name} card={match} quest={quest} partner={couple.them} onClose={() => setMatch(null)} />}</AnimatePresence>
            </div>
            <div className="flex min-h-11 items-center justify-center">
              <AnimatePresence mode="popLayout">
                {last && (
                  <motion.button
                    key={last.card.name}
                    type="button"
                    onClick={undo}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: ease.out }}
                    className="press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label text-muted-foreground hover:bg-muted hover:text-ink"
                  >
                    <Undo2 className="size-4" />
                    Undo {verdictLabel[last.verdict].toLowerCase()} on {last.card.name}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-6 @4xl:col-start-2 @4xl:row-span-2 @4xl:row-start-1 @7xl:col-start-3 @7xl:row-span-1">
            <Shortlist quest={quest} partner={couple.them} onAdd={addName} />
            {unlocked ? (
              <FinalRound quest={quest} mine={mine?.judged ?? 0} theirs={theirs?.judged} couple={couple} onJudge={judge} />
            ) : (
              <FinalLocked quest={quest} />
            )}
            {quest.talkAbout.length > 0 && <TalkAbout quest={quest} couple={couple} />}
          </div>

          <ListsPanel quest={quest} onToggle={toggleList} sex={sex} pop={pop} onFilter={filter} />
        </div>

        <SourceLine sources={quest.sources} />
      </div>
    </LayoutGroup>
  );
}

function QuestProgress({ quest, couple, mine, theirs }: { quest: NamesQuest; couple: Couple; mine: number; theirs?: number }) {
  const current = quest.stages.find((s) => !s.done)?.id;
  return (
    <SoftCard tone="sun" className="flex flex-col gap-5 @5xl:flex-row @5xl:items-center @5xl:justify-between">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Quest stages">
        {quest.stages.map((s, i) => {
          const { icon: Icon, label } = stageInfo[s.id];
          const now = s.id === current;
          return (
            <li key={s.id} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className={cn("h-0.5 w-4 rounded-full @3xl:w-8", s.done || now ? "bg-me-mid" : "bg-line-2")} />}
              <span
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-label",
                  s.done ? "bg-leaf-soft text-leaf" : now ? "bg-me text-white" : "bg-card/70 text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                {label}
                <span className="sr-only">{s.done ? ", done" : now ? ", now" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-2.5 @5xl:min-w-[22rem]">
        <ParentBar person={couple.me} label="You" n={mine} goal={quest.swipeGoal} tone="me" />
        {couple.them && theirs !== undefined && <ParentBar person={couple.them} label={couple.them.displayName} n={theirs} goal={quest.swipeGoal} tone="them" />}
      </div>
    </SoftCard>
  );
}

function ParentBar({ person, label, n, goal, tone }: { person: Parent; label: string; n: number; goal: number; tone: "me" | "them" }) {
  const pct = Math.min(1, n / goal);
  return (
    <div className="flex items-center gap-3">
      <Avatar person={person} size="sm" />
      <span className="w-16 truncate text-label">{label}</span>
      <span className={cn("relative h-2 flex-1 overflow-hidden rounded-full", tone === "me" ? "bg-me-soft" : "bg-them-soft")}>
        <motion.span
          className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", tone === "me" ? "bg-me" : "bg-them")}
          initial={false}
          animate={{ scaleX: pct }}
          transition={spring.ui}
        />
      </span>
      <span className="w-14 text-right font-mono text-caption text-muted-foreground">
        {Math.min(n, goal)}/{goal}
      </span>
    </div>
  );
}

function ListsPanel({
  quest,
  onToggle,
  sex,
  pop,
  onFilter,
}: {
  quest: NamesQuest;
  onToggle: (id: string) => void;
  sex: NameSex | "any";
  pop: Popularity;
  onFilter: (s: NameSex | "any", p: Popularity) => void;
}) {
  return (
    <section aria-labelledby="lists-title" className="flex min-w-0 flex-col gap-5 @4xl:col-start-1 @4xl:row-start-2 @7xl:col-start-1 @7xl:row-start-1">
      <div>
        <h2 id="lists-title" className="text-title">
          Lists in your deck
        </h2>
        <p className="mt-1 text-label font-normal text-muted-foreground">Shared by you both. Pick the heritage you want to hear.</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {quest.lists.map((l) => {
          const on = quest.chosen.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(l.id)}
                className={cn(
                  "press inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-label transition-colors duration-(--duration-fast)",
                  on ? "border-transparent bg-me text-white" : "border-line bg-card text-ink-2 hover:bg-muted",
                )}
              >
                {on && <Check className="size-3.5" />}
                {l.title}
                <span className={cn("font-mono text-caption", on ? "text-white/75" : "text-muted-foreground")}>{l.size}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Segmented
        label="For"
        value={sex}
        options={[
          ["any", "Any"],
          ["girl", "Girl"],
          ["boy", "Boy"],
          ["neutral", "Either"],
        ]}
        onChange={(v) => onFilter(v, pop)}
      />
      <Segmented
        label="How common"
        value={pop}
        options={[
          ["any", "Any"],
          ["rare", "Rare"],
          ["popular", "Popular"],
        ]}
        onChange={(v) => onFilter(sex, v)}
      />
      <p className="text-caption text-muted-foreground">Rare means fewer than 1,000 US babies a year, popular more than 5,000.</p>
    </section>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-full bg-muted p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === value}
            onClick={() => onChange(v)}
            className={cn(
              "min-h-9 flex-1 rounded-full px-3 text-label transition-[background-color,color,box-shadow] duration-(--duration-fast)",
              v === value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeckDone({ pop, sex, onWiden }: { pop: Popularity; sex: NameSex | "any"; onWiden: () => void }) {
  const narrowed = pop !== "any" || sex !== "any";
  return (
    <SoftCard tone="leaf" className="flex min-h-[22rem] flex-col items-center justify-center gap-3 text-center">
      <Sparkles className="size-8 text-leaf" />
      <p className="text-title">You have answered every name here</p>
      <p className="max-w-xs text-body text-ink-2">{narrowed ? "Widen the filters for more." : "Add another list for more names, or add one you already love."}</p>
      {narrowed && (
        <button type="button" onClick={onWiden} className="press mt-1 min-h-11 rounded-full bg-card px-5 text-label">
          Show every name
        </button>
      )}
    </SoftCard>
  );
}

function MatchCelebration({ card, quest, partner, onClose }: { card: NameCard; quest: NamesQuest; partner?: Parent; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: ease.out }}
    >
      <motion.div
        className="relative mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-[1.75rem] bg-sun px-6 py-10 text-center shadow-[0_18px_40px_-20px_rgb(43_38_32/0.45)]"
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.playful}
      >
        <span className="relative grid size-16 place-items-center rounded-full bg-card">
          <Heart className="size-8 fill-me text-me" />
          <Burst colors={["bg-me", "bg-them", "bg-butter"]} radius={52} />
        </span>
        <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">A match</p>
        <p className="text-display">{card.name}</p>
        <p className="text-body text-ink-2">You and {partner?.displayName ?? "your partner"} both love it. It is on your shortlist now.</p>
        {card.popularity && rankWords(card) && <p className="font-mono text-caption text-muted-foreground">{rankWords(card)} · {quest.year}</p>}
        <button ref={close} type="button" onClick={onClose} className="press mt-2 min-h-11 rounded-full bg-me px-6 text-label text-white">
          Keep swiping
        </button>
      </motion.div>
    </motion.div>
  );
}

function Shortlist({ quest, partner, onAdd }: { quest: NamesQuest; partner?: Parent; onAdd: (name: string) => Promise<boolean> }) {
  const slots = Math.max(quest.matchGoal, quest.matches.length);
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <SoftCard as="section" aria-labelledby="shortlist-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="shortlist-title" className="text-title">
          Names you both love
        </h2>
        <span className="font-mono text-caption text-muted-foreground">
          {quest.matches.length}/{quest.matchGoal}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
        {Array.from({ length: slots }, (_, i) => {
          const m = quest.matches[i];
          if (!m)
            return (
              <li key={`slot-${i}`} className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-line-2 px-4 text-label font-normal text-muted-foreground">
                <Heart className="size-4" /> Match {i + 1}
              </li>
            );
          return (
            <motion.li
              key={m.name}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring.ui}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-muted px-4 py-2"
            >
              <Heart className="size-4 shrink-0 fill-me text-me" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-title">{m.name}</p>
                <p className="truncate text-caption text-muted-foreground">
                  {[m.meaning && `“${m.meaning}”`, rankWords(m), listTitles(m, quest)[0]].filter(Boolean).join(" · ")}
                </p>
              </div>
              {m.popularity && <NameTrend years={quest.trendYears} counts={m.popularity.trend} className="hidden w-20 @md:block" />}
            </motion.li>
          );
        })}
        </AnimatePresence>
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          start(async () => {
            const ok = await onAdd(n);
            setNote(ok ? `${n} is in ${partner?.displayName ?? "your partner"}'s deck now.` : "That did not save. Try again.");
            if (ok) setName("");
          });
        }}
      >
        <label htmlFor="add-name" className="sr-only">
          Add a name you love
        </label>
        <input
          id="add-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="A name you already love"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line-2 bg-card px-4 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" disabled={pending || !name.trim()} className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-label text-white disabled:opacity-40">
          <Plus className="size-4" /> Add
        </button>
      </form>
      {note && <p className="-mt-2 text-caption text-muted-foreground">{note}</p>}
    </SoftCard>
  );
}

function FinalLocked({ quest }: { quest: NamesQuest }) {
  const toGo = Math.max(0, quest.matchGoal - quest.matches.length);
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-dashed border-line-2 px-5 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
        <Lock className="size-4 text-muted-foreground" />
      </span>
      <p className="text-label font-normal text-ink-2">
        The final round opens at {quest.matchGoal} matches. <span className="font-medium text-ink">{toGo} to go.</span>
      </p>
    </div>
  );
}

function FinalRound({ quest, mine, theirs, couple, onJudge }: { quest: NamesQuest; mine: number; theirs?: number; couple: Couple; onJudge: (w: NameCard, l: NameCard) => void }) {
  const [a, b] = quest.nextPair;
  return (
    <SoftCard as="section" tone="them" aria-labelledby="final-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-them" />
        <h2 id="final-title" className="text-title">
          Final round
        </h2>
      </div>
      <div className="grid gap-2">
        <ParentBar person={couple.me} label="You" n={mine} goal={quest.pairCount} tone="me" />
        {couple.them && theirs !== undefined && <ParentBar person={couple.them} label={couple.them.displayName} n={theirs} goal={quest.pairCount} tone="them" />}
      </div>
      {a && b && (
        <div className="flex flex-col gap-2">
          <p className="text-label">Which one do you love more?</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${a.name}-${b.name}`}
              className="grid grid-cols-2 gap-2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: ease.out }}
            >
              {[
                [a, b],
                [b, a],
              ].map(([w, l]) => (
                <button key={w.name} type="button" onClick={() => onJudge(w, l)} className="press lift min-h-20 rounded-2xl bg-card px-3 text-title break-words">
                  {w.name}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      {quest.top.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">{quest.finishedAt ? "Your top 3" : "Your top 3 so far"}</p>
          <ol className="flex flex-col gap-1.5">
            {quest.top.map((t, i) => (
              <motion.li layout key={t.name} transition={spring.ui} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2.5">
                <span className={cn("grid size-7 place-items-center rounded-full font-mono text-caption", i === 0 ? "bg-butter text-ink" : "bg-muted text-ink-2")}>{i + 1}</span>
                <span className="text-title">{t.name}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      )}
      {/* TODO(names-quest): award the finished-quest sticker here once the missions-badges award hook is on main. */}
      {quest.finishedAt && <p className="text-label font-normal text-ink-2">You both finished the final round. Say them out loud together tonight.</p>}
    </SoftCard>
  );
}

function TalkAbout({ quest, couple }: { quest: NamesQuest; couple: Couple }) {
  return (
    <SoftCard as="section" aria-labelledby="talk-title" className="flex flex-col gap-3">
      <div>
        <h2 id="talk-title" className="text-title">
          Worth a talk
        </h2>
        <p className="mt-1 text-label font-normal text-muted-foreground">One of you loves it, the other is a maybe.</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {quest.talkAbout.map((t) => (
          <li key={t.card.name} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-muted py-1 pr-3.5 pl-1.5">
            <span className="inline-flex -space-x-1">
              <Avatar person={couple.me} size="sm" className={cn("ring-2 ring-muted", t.mine !== "love" && "opacity-45")} />
              {couple.them && <Avatar person={couple.them} size="sm" className={cn("ring-2 ring-muted", t.theirs !== "love" && "opacity-45")} />}
            </span>
            <span className="text-label">{t.card.name}</span>
            <span className="sr-only">
              you: {verdictLabel[t.mine]}, {couple.them?.displayName}: {verdictLabel[t.theirs]}
            </span>
          </li>
        ))}
      </ul>
    </SoftCard>
  );
}
