"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Check, MessageCircleHeart, PenLine, Plus, Stethoscope } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PlanCategory, PlanItemStatus, Source } from "@/lib/api/types";
import { SoftCard } from "@/components/joy/soft-card";
import { SourceLine } from "@/components/joy/source-line";
import { duration, ease, spring } from "@/components/joy/motion";
import { categoryIcon, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";

// "Also this week": the practical things, small and calm, under the hero and
// the reads. Each row says what and when; "Why" opens the reason with its
// source and checked date in place. The visit row opens the questions to ask
// there. "See all" is the full plan.

export type CalmRow =
  | {
      kind: "visit";
      id: string;
      title: string;
      when: string;
      /** "Jake is coming". */
      note?: string;
      questions: { id: string; text: string }[];
    }
  | {
      kind: "plan";
      id: string;
      ruleId: string;
      category: PlanCategory;
      status: PlanItemStatus;
      title: string;
      when: string;
      why: string;
      source: Source;
      /** The written weekly note's line for this item, when the AI note has one. */
      note?: string;
      /** Shown only after "more from your plan". */
      later?: boolean;
    }
  | { kind: "bag"; id: string; title: string; when: string; done: number; total: number; parts: { name: string; count: number; color: string }[]; href?: string }
  | { kind: "talk"; id: string; title: string; when: string; why: string; href: string; source: Source };

export function CalmList({ memberId, rows, footer, className }: { memberId: string; rows: CalmRow[]; footer?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const later = rows.filter((r) => r.kind === "plan" && r.later).length;
  const shown = all ? rows : rows.filter((r) => !(r.kind === "plan" && r.later));
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  return (
    <SoftCard as="section" aria-labelledby="calm-title" className={cn("flex flex-col", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="calm-title" className="text-title">
          Also this week
        </h2>
        <Link href={`/family/${memberId}/plan`} className="group inline-flex min-h-11 items-center gap-1 text-label font-medium text-ink-2 hover:text-ink md:min-h-8">
          See all
          <ArrowRight aria-hidden className="size-3.5 transition-transform duration-(--duration-fast) ease-(--ease-out) pointer-fine:group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ul className="mt-2">
        <AnimatePresence initial={false}>
          {shown.map((row) => (
            <Row key={row.id} row={row} memberId={memberId} open={open === row.id} onToggle={() => toggle(row.id)} />
          ))}
        </AnimatePresence>
      </ul>
      {later > 0 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((a) => !a)}
          className="press mt-1 min-h-11 self-start rounded-full px-3 text-label font-medium text-ink-2 transition-colors duration-(--duration-fast) hover:bg-muted md:min-h-9"
        >
          {all ? "Show less" : `${later} more from your plan`}
        </button>
      )}
      {footer && <div className="mt-3 border-t border-line pt-4">{footer}</div>}
    </SoftCard>
  );
}

function Icon({ row }: { row: CalmRow }) {
  const I = row.kind === "visit" ? Stethoscope : row.kind === "bag" ? Briefcase : row.kind === "talk" ? MessageCircleHeart : categoryIcon[row.category];
  const tint = row.kind === "plan" && row.status !== "upcoming" ? statusTint[row.status] : "bg-muted text-ink-2";
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tint)}>
      <I aria-hidden className="size-4.5" strokeWidth={1.8} />
    </span>
  );
}

const linkBtn = "min-h-11 shrink-0 px-1 text-label font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:decoration-current md:min-h-8";

function Row({ row, memberId, open, onToggle }: { row: CalmRow; memberId: string; open: boolean; onToggle: () => void }) {
  const panel = `calm-${row.id}`;
  let right: React.ReactNode = null;
  if (row.kind === "plan" || row.kind === "talk")
    right = (
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className={linkBtn}>
        Why
      </button>
    );
  if (row.kind === "visit")
    right = (
      <span className="flex flex-col items-end gap-0.5">
        {row.note && <span className="text-caption text-muted-foreground">{row.note}</span>}
        <button type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle} className={linkBtn}>
          {row.questions.length > 0 ? "Questions" : "Add a question"}
        </button>
      </span>
    );
  if (row.kind === "bag")
    right = (
      <span className="flex h-1.5 w-18 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.done} of ${row.total} packed`}>
        {row.parts.map((p) => (
          <span key={p.name} className={p.color} style={{ width: `${(p.count / Math.max(1, row.total)) * 100}%` }} />
        ))}
      </span>
    );

  const title =
    row.kind === "bag" && row.href ? (
      <Link href={row.href} className="hover:underline hover:decoration-line-2 hover:underline-offset-4">
        {row.title}
      </Link>
    ) : (
      row.title
    );

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring.ui}
      className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line py-3 first:border-t-0"
    >
      <Icon row={row} />
      <div className="min-w-0">
        <p className="text-body font-semibold">{title}</p>
        <p className="text-label font-normal text-muted-foreground">{row.when}</p>
      </div>
      <div className="justify-self-end">{right}</div>
      <AnimatePresence initial={false}>
        {open && row.kind !== "bag" && (
          <motion.div
            id={panel}
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="col-span-2 col-start-2 overflow-hidden"
          >
            {row.kind !== "visit" ? (
              <div className="mt-2.5 rounded-xl bg-muted/70 px-3 py-2.5 text-label font-normal text-ink-2">
                {row.kind === "plan" && row.note && (
                  <p className="mb-1.5 flex items-start gap-1.5 font-medium text-ink">
                    <PenLine aria-hidden className="mt-0.5 size-3.5 shrink-0 text-me" />
                    {row.note}
                  </p>
                )}
                <p>{row.why}</p>
                {row.kind === "talk" && (
                  <Link href={row.href} className="mt-2 inline-flex min-h-9 items-center gap-1 font-semibold text-me underline decoration-me/40 underline-offset-4 hover:decoration-current">
                    Find someone to talk to
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                )}
                <SourceLine sources={[row.source]} className="mt-1.5" />
              </div>
            ) : (
              <VisitQuestions memberId={memberId} initial={row.questions} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function VisitQuestions({ memberId, initial }: { memberId: string; initial: { id: string; text: string }[] }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const { data, error } = await api.POST("/members/{memberId}/appointment-questions", {
      params: { path: { memberId } },
      body: { text: value, visibility: "private" },
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.code === "no_upcoming_appointment" ? "There is no visit to attach it to yet." : "Could not save your question. Please try again.");
      return;
    }
    setItems((q) => [...q, { id: data.id, text: data.text }]);
    setText("");
  }

  return (
    <div className="mt-2.5 rounded-xl bg-muted/70 px-3 py-2.5">
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((q) => (
            <motion.li key={q.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.ui} className="flex items-start gap-2 text-label font-normal text-ink-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf" />
              {q.text}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form onSubmit={add} className={cn("flex items-center gap-2", items.length > 0 && "mt-2.5")}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          aria-label="A question to ask at the visit"
          placeholder="Add a question to ask"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-2 bg-card px-3.5 text-body outline-none focus:border-me md:h-9"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Add the question" className="press inline-flex size-11 items-center justify-center rounded-full bg-me text-white disabled:opacity-45 md:size-9">
          <Plus aria-hidden className="size-4" />
        </button>
      </form>
      <p className="mt-1.5 text-caption text-muted-foreground">Private to you unless you share it.</p>
    </div>
  );
}
