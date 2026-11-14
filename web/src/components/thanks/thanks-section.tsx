"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";
import type { Thanks, ThanksSuggestion as ThanksSuggestionData } from "@/lib/api/types";
import { agoWords } from "@/lib/care";
import type { Person } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Avatar, PartnerChip } from "@/components/joy/partner-chip";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { spring } from "@/components/joy/motion";
import { ThanksSuggestion, type ThanksDraft } from "./thanks-suggestion";

const STARTERS = ["Thank you for taking tonight.", "I saw how much you did today. Thank you.", "Thank you for thinking of that before I did."];

// Thank-you notes between the parents (and to a grandparent or nanny). The API
// words each suggestion from the care log, tasks and shifts; the parent edits
// and sends. What the other parent sent shows as a warm card that glides in.
export function ThanksSection({
  memberId,
  people,
  suggestions: initialSuggestions,
  thanks: initialThanks,
  now,
}: {
  memberId: string;
  people: Person[];
  suggestions: ThanksSuggestionData[];
  thanks: Thanks[];
  now: Date;
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [thanks, setThanks] = useState(initialThanks);
  const [starter, setStarter] = useState<ThanksDraft | null>(null);
  const recipients = people.filter((p) => p.id !== memberId);
  const partner = recipients.find((p) => p.role === "mother" || p.role === "partner");
  const person = (id: string) => people.find((p) => p.id === id);
  const received = thanks.filter((t) => t.toMemberId === memberId).slice(0, 2);
  const sent = thanks.filter((t) => t.fromMemberId === memberId).slice(0, 2);

  function onSent(t: Thanks, key?: string) {
    setThanks((all) => [t, ...all]);
    if (key) setSuggestions((all) => all.filter((s) => s.key !== key));
    else setStarter(null);
  }

  return (
    <SoftCard as="section" aria-labelledby="thanks-title" className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h2 id="thanks-title" className="text-headline">
          Say thanks
        </h2>
        {/* Where a sent note lands. Each chip is the target of the card's flight. */}
        <ul className="flex flex-wrap gap-2">
          {recipients.map((p) => (
            <li key={p.id} data-thanks-chip={p.id} className="inline-flex">
              <PartnerChip person={p} />
            </li>
          ))}
        </ul>
      </header>

      {received.map((t, k) => {
        const from = person(t.fromMemberId);
        return (
          <Rise as="div" key={t.id} i={k}>
            <motion.article
              initial={{ opacity: 0, x: 36, y: -6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ ...spring.gentle, delay: 0.15 + k * 0.1 }}
              className="rounded-2xl bg-them-soft p-4"
            >
              <p className="flex items-center gap-2 text-label text-ink-2">
                {from && <Avatar person={from} size="sm" />}
                {from?.displayName ?? "Someone"} says thanks
                <Heart aria-hidden className="size-4 text-them" />
                <span className="ml-auto font-mono text-caption text-muted-foreground">{agoWords(t.createdAt, now)}</span>
              </p>
              <p className="mt-2 font-display text-title">{t.body}</p>
            </motion.article>
          </Rise>
        );
      })}

      <ul className="flex flex-col gap-3">
        {suggestions.slice(0, 3).map((s) => (
          <ThanksSuggestion key={s.key} memberId={memberId} suggestion={s} people={people} onSent={onSent} />
        ))}
        {starter && <ThanksSuggestion key={starter.text} memberId={memberId} suggestion={starter} people={people} onSent={onSent} />}
      </ul>

      {suggestions.length === 0 && !starter && partner && (
        <div className="flex flex-col gap-2">
          <p className="text-label text-ink-2">Nothing new to name yet. Start with a few words:</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setStarter({ toMemberId: partner.id, text })}
                className={cn("press min-h-11 rounded-full border border-dashed border-line-2 px-4 text-left text-label text-ink-2 transition-colors duration-150 hover:bg-muted")}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
          {sent.map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 text-label text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">
                You thanked {person(t.toMemberId)?.displayName ?? "them"}: {t.body}
              </span>
              <span className="shrink-0 font-mono text-caption">{agoWords(t.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </SoftCard>
  );
}
