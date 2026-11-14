"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { CircleHelp, Heart, X } from "lucide-react";
import type { NameCard, NamesQuest, NameVerdict } from "@/lib/api/types";
import { ease, spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { NameTrend } from "./name-trend";
import { fmt, listTitles, rankWords, sexLabel } from "./model";

// The swipe deck. While the finger is down the top card is the finger (x is a
// motion value, no spring); on release it flies off with the release velocity
// when it passed the distance or the flick threshold, else snaps back. Buttons
// and the arrow keys answer too: buttons throw the card the same way, keys
// commit at once without motion (a keyboard action never animates).

const THROW = 110; // px of travel that counts as an answer
const FLICK = 520; // px/s that counts as an answer on a short move

export function NameDeck({
  cards,
  quest,
  partnerName,
  onAnswer,
}: {
  cards: NameCard[];
  quest: NamesQuest;
  partnerName?: string;
  onAnswer: (card: NameCard, verdict: NameVerdict) => void;
}) {
  const top = cards[0];
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-240, 240], [-10, 10]);
  const loveStamp = useTransform(x, [24, THROW], [0, 1]);
  const noStamp = useTransform(x, [-THROW, -24], [1, 0]);
  const busy = useRef(false);

  // A new top card starts centred.
  useEffect(() => {
    x.set(0);
    y.set(0);
    opacity.set(1);
    busy.current = false;
  }, [top?.name, x, y, opacity]);

  const commit = (verdict: NameVerdict) => {
    if (!top) return;
    onAnswer(top, verdict);
  };

  const throwCard = async (verdict: NameVerdict, velocity = 0) => {
    if (!top || busy.current) return;
    busy.current = true;
    if (reduce) {
      await animate(opacity, 0, { duration: 0.15, ease: ease.out });
    } else if (verdict === "maybe") {
      await Promise.all([animate(y, -420, { type: "spring", bounce: 0, duration: 0.4, velocity }), animate(opacity, 0, { duration: 0.3, ease: ease.out })]);
    } else {
      const dir = verdict === "love" ? 1 : -1;
      await Promise.all([animate(x, dir * 640, { type: "spring", bounce: 0, duration: 0.45, velocity }), animate(opacity, 0, { duration: 0.35, delay: 0.05, ease: ease.out })]);
    }
    commit(verdict);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const verdict: NameVerdict | undefined = e.key === "ArrowRight" ? "love" : e.key === "ArrowLeft" ? "no" : e.key === "ArrowUp" ? "maybe" : undefined;
      if (!verdict || !top || busy.current) return;
      e.preventDefault();
      busy.current = true;
      commit(verdict);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative grid w-full max-w-md [grid-template-areas:'stack']">
        {cards
          .slice(0, 3)
          .reverse()
          .map((card, i, shown) => {
            const depth = shown.length - 1 - i;
            return (
              <motion.div
                key={card.name}
                aria-hidden={depth > 0 || undefined}
                className={cn("[grid-area:stack]", depth > 0 ? "pointer-events-none" : "z-10")}
                initial={false}
                animate={{ scale: 1 - depth * 0.04, y: depth * 14 }}
                transition={spring.ui}
              >
                {depth > 0 ? (
                  <CardFace card={card} quest={quest} partnerName={partnerName} muted />
                ) : (
                  <motion.div
                    className="relative cursor-grab touch-pan-y active:cursor-grabbing"
                    style={{ x, y, rotate, opacity }}
                    drag="x"
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > THROW || info.velocity.x > FLICK) void throwCard("love", info.velocity.x);
                      else if (info.offset.x < -THROW || info.velocity.x < -FLICK) void throwCard("no", info.velocity.x);
                      else animate(x, 0, { type: "spring", bounce: reduce ? 0 : 0.25, duration: 0.4, velocity: info.velocity.x });
                    }}
                  >
                    <CardFace card={card} quest={quest} partnerName={partnerName} />
                    <motion.span
                      aria-hidden
                      style={{ opacity: loveStamp }}
                      className="pointer-events-none absolute top-6 left-6 inline-flex -rotate-12 items-center gap-1.5 rounded-xl border-2 border-leaf bg-card px-3 py-1 text-label font-semibold tracking-wide text-leaf uppercase"
                    >
                      <Heart className="size-4 fill-current" /> Love
                    </motion.span>
                    <motion.span
                      aria-hidden
                      style={{ opacity: noStamp }}
                      className="pointer-events-none absolute top-6 right-6 inline-flex rotate-12 items-center gap-1.5 rounded-xl border-2 border-ink-2 bg-card px-3 py-1 text-label font-semibold tracking-wide text-ink-2 uppercase"
                    >
                      <X className="size-4" /> Not for us
                    </motion.span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
      </div>

      <div className="flex items-center gap-3" role="group" aria-label={top ? `Your answer on ${top.name}` : "Your answer"}>
        <AnswerButton label="Not for us" hint="Left arrow" onClick={() => void throwCard("no")} disabled={!top} className="size-14 bg-card text-ink-2">
          <X className="size-6" />
        </AnswerButton>
        <AnswerButton label="Maybe" hint="Up arrow" onClick={() => void throwCard("maybe")} disabled={!top} className="size-12 bg-card text-muted-foreground">
          <CircleHelp className="size-5" />
        </AnswerButton>
        <AnswerButton label="Love" hint="Right arrow" onClick={() => void throwCard("love")} disabled={!top} className="size-16 border-transparent bg-me text-white">
          <Heart className="size-7 fill-current" />
        </AnswerButton>
      </div>
      <p className="hidden font-mono text-caption text-muted-foreground md:block">drag, or use ← ↑ →</p>
    </div>
  );
}

function AnswerButton({ label, hint, className, children, ...props }: React.ComponentProps<"button"> & { label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${hint})`}
      className={cn(
        "press inline-flex items-center justify-center rounded-full border border-line shadow-sm transition-[background-color,opacity] duration-(--duration-fast) disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** The face of a name card: lists, the name, its sourced meaning when there is one, and US popularity. */
export function CardFace({ card, quest, partnerName, muted = false }: { card: NameCard; quest: NamesQuest; partnerName?: string; muted?: boolean }) {
  const titles = listTitles(card, quest);
  const rank = rankWords(card);
  const pop = card.popularity;
  return (
    <article
      className={cn(
        "flex min-h-[22rem] flex-col gap-5 rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_12px_32px_-18px_rgb(43_38_32/0.35)] select-none md:p-8",
        muted && "shadow-none",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-caption">
        {card.sex && <span className="rounded-full bg-me-soft px-2.5 py-1 font-medium text-me">{sexLabel[card.sex]}</span>}
        {titles.map((t) => (
          <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-ink-2">
            {t}
          </span>
        ))}
        {card.addedBy && partnerName && <span className="rounded-full bg-them-soft px-2.5 py-1 font-medium text-them">{partnerName} added it</span>}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 py-2 text-center">
        <h3 className="text-display break-words">{card.name}</h3>
        {card.meaning ? (
          <p className="text-body text-ink-2">
            “{card.meaning}”{card.origin && <span className="text-muted-foreground"> · {card.origin}</span>}
          </p>
        ) : (
          card.origin && <p className="text-body text-muted-foreground">{card.origin}</p>
        )}
        {card.sourceUrl && (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noopener"
            onPointerDown={(e) => e.stopPropagation()}
            className="mx-auto font-mono text-caption text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink"
          >
            Wiktionary
          </a>
        )}
      </div>

      {pop && (
        <div className="flex items-end justify-between gap-4 rounded-2xl bg-muted px-4 py-3">
          <div className="min-w-0">
            <p className="text-label">{rank ?? "Rare in the US"}</p>
            <p className="font-mono text-caption text-muted-foreground">
              {pop.babies > 0 ? `${fmt(pop.babies)} babies in ${quest.year}` : `under 5 babies in ${quest.year}`}
            </p>
          </div>
          <NameTrend years={quest.trendYears} counts={pop.trend} />
        </div>
      )}
    </article>
  );
}
