"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, MapPin, Printer } from "lucide-react";
import { toast } from "sonner";
import type { RightsCard } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SourceLine } from "@/components/joy/source-line";
import { duration, ease } from "@/components/joy/motion";

type State = { title: string; text: string; source: RightsCard["source"] };

/** Opens the note in its own window and prints it: the note text goes in as text, never as markup. */
function printNote(subject: string, body: string) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Your browser blocked the print window. Copy the note instead.");
    return;
  }
  w.document.title = subject;
  const h = w.document.createElement("h1");
  h.textContent = subject;
  h.style.cssText = "font:600 20px Georgia,serif;margin:0 0 16px";
  const pre = w.document.createElement("pre");
  pre.textContent = body;
  pre.style.cssText = "font:16px/1.5 Georgia,serif;white-space:pre-wrap;margin:0";
  w.document.body.style.cssText = "margin:48px;max-width:640px";
  w.document.body.append(h, pre);
  w.print();
}

/**
 * Workplace rights as short cards: one law at a time, what it covers, what you
 * can ask your employer, and a request note you edit before copying or printing.
 * Not legal advice: said once, here.
 */
export function RightsAcademy({ cards, state, memberId, showLeavePlanner }: { cards: RightsCard[]; state: State; memberId: string; showLeavePlanner: boolean }) {
  const [id, setId] = useState(cards[0]?.id);
  const card = cards.find((c) => c.id === id) ?? cards[0];
  return (
    <section aria-labelledby="rights-title" className="rounded-3xl border border-line bg-card p-5.5 md:p-7">
      <h2 id="rights-title" className="text-headline">
        Your rights at work
      </h2>
      <p className="mt-1 text-label text-muted-foreground">General information from official pages, not legal advice. For your own case, ask HR, your state labor department or a lawyer.</p>
      <div role="tablist" aria-label="Workplace rights" className="mt-4 flex flex-wrap gap-2">
        {cards.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === card.id}
            onClick={() => setId(c.id)}
            className={cn("press min-h-11 rounded-full px-4 text-label font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-ring/50", c.id === card.id ? "bg-ink text-paper" : "bg-muted text-ink-2 hover:bg-line")}
          >
            {c.title}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={card.id}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="mt-5 flex flex-col gap-4"
        >
          <RightsBody card={card} />
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex items-start gap-3 text-body">
          <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">{state.title}</p>
            <p className="text-ink-2">{state.text}</p>
            <SourceLine sources={[state.source]} className="mt-1" />
          </div>
        </div>
        {showLeavePlanner && (
          <Link href={`/family/${memberId}/plan`} className="press inline-flex min-h-11 items-center self-start rounded-full bg-sun px-4 text-label font-medium text-ink">
            Plan your leave dates in the leave planner
          </Link>
        )}
      </div>
    </section>
  );
}

function RightsBody({ card }: { card: RightsCard }) {
  const [note, setNote] = useState(card.note.body);
  const [showNote, setShowNote] = useState(false);
  return (
    <>
      <p className="text-label font-medium text-muted-foreground">{card.law}</p>
      <p className="text-body text-ink-2">{card.covers}</p>
      <div>
        <h3 className="text-title">What you can ask your employer</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {card.ask.map((a) => (
            <li key={a} className="flex gap-2.5 text-body">
              <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-status-ok" strokeWidth={2.5} />
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-label text-muted-foreground">{card.howToAsk}</p>
      </div>
      <SourceLine sources={[card.source]} />
      <div className="rounded-2xl bg-leaf-soft p-4">
        <button type="button" onClick={() => setShowNote((s) => !s)} aria-expanded={showNote} className="press min-h-11 w-full text-left text-title outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          A note you can send: {card.note.subject.toLowerCase()}
        </button>
        <AnimatePresence initial={false}>
          {showNote && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: ease.out }} className="overflow-hidden">
              <label htmlFor={`note-${card.id}`} className="sr-only">
                Request note
              </label>
              <textarea
                id={`note-${card.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={12}
                className="mt-2 w-full resize-y rounded-xl border border-line bg-card p-3 font-mono text-label leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="mt-1 text-caption text-muted-foreground">Fill in the [brackets] before you send it. It stays on this page; nothing is saved.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-11 px-4 text-label"
                  onClick={async () => {
                    await navigator.clipboard.writeText(note);
                    toast("Note copied");
                  }}
                >
                  <Copy aria-hidden /> Copy
                </Button>
                <Button variant="outline" className="h-11 px-4 text-label" onClick={() => printNote(card.note.subject, note)}>
                  <Printer aria-hidden /> Print
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
