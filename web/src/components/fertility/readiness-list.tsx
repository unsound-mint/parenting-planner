"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HeartHandshake, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PreconceptionChecklist, PreconceptionGroup, PreconceptionItem } from "@/lib/api/types";
import { duration, ease, stagger } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

const groupTitle: Record<PreconceptionGroup, string> = {
  appointments: "Appointments",
  vitamins: "Vitamins",
  questions: "Questions for the doctor",
  vaccines: "Vaccines",
  lifestyle: "Lifestyle",
  partner_health: "Partner health",
};

type Props = { memberId: string; initial: PreconceptionChecklist; partnerName?: string; name: string };

/**
 * Each parent's own checklist. A tick is private unless the parent shares that tick
 * with the partner, one item at a time. The partner's shared ticks show beside the same
 * item, and items that only apply to the partner appear at the end when they shared them.
 * Motion: the check draws itself (about 0.3 s), the progress bar grows from the left and
 * the rows rise in turn. Reduced motion is handled by MotionConfig.
 */
export function ReadinessList({ memberId, initial, partnerName, name }: Props) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const mine = list.items.filter((i) => !i.partnerOnly);
  const theirs = list.items.filter((i) => i.partnerOnly);
  const groups = [...new Set(mine.map((i) => i.group))];

  async function put(item: PreconceptionItem, done: boolean, visibility = item.visibility ?? "private") {
    setBusy(item.key);
    const before = list;
    // Optimistic: the tick lands at once, the server answer replaces it.
    setList({
      ...list,
      done: list.done + (done === item.done ? 0 : done ? 1 : -1),
      items: list.items.map((i) => (i.key === item.key && !i.partnerOnly ? { ...i, done, visibility: done ? visibility : undefined } : i)),
    });
    const { data, response } = await api.PUT("/members/{memberId}/preconception-checklist/{itemKey}", { params: { path: { memberId, itemKey: item.key } }, body: { done, visibility } });
    setBusy(null);
    if (!response.ok || !data) {
      setList(before);
      toast.error("That did not save. Try again in a moment.");
      return;
    }
    setList(data);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-title">
            {list.done} of {list.total} done
          </p>
          {partnerName && list.partnerShared > 0 && (
            <p className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
              <HeartHandshake className="size-3.5" aria-hidden />
              {partnerName} shared {list.partnerShared}
            </p>
          )}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={list.done} aria-valuemin={0} aria-valuemax={list.total} aria-label={`${name}'s checklist`}>
          <motion.div
            className="h-full origin-left rounded-full bg-me"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: list.total ? list.done / list.total : 0 }}
            transition={{ duration: duration.slow, ease: ease.out }}
          />
        </div>
      </div>

      {groups.map((g, gi) => (
        <section key={g} aria-labelledby={`g-${g}`} className="flex flex-col">
          <h2 id={`g-${g}`} className="mb-1 font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">
            {groupTitle[g]}
          </h2>
          <ul>
            {mine
              .filter((i) => i.group === g)
              .map((item, n) => (
                <motion.li
                  key={item.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.enter, ease: ease.out, delay: (gi + n) * stagger }}
                  className="flex items-start gap-3 border-t border-line py-3.5 first:border-t-0"
                >
                  <Tick on={item.done} busy={busy === item.key} label={item.title} onClick={() => put(item, !item.done)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-label transition-colors duration-(--duration-base)", item.done ? "text-muted-foreground" : "text-ink")}>{item.title}</p>
                    <p className="mt-0.5 text-caption font-normal text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.partnerDone && partnerName && (
                      <span title={`${partnerName} did this and shared it`} className="inline-flex size-7 items-center justify-center rounded-full bg-them text-caption font-semibold text-white">
                        {partnerName.charAt(0)}
                      </span>
                    )}
                    {item.done && partnerName && (
                      <button
                        type="button"
                        onClick={() => put(item, true, item.visibility === "partner" ? "private" : "partner")}
                        aria-pressed={item.visibility === "partner"}
                        aria-label={item.visibility === "partner" ? "Stop sharing this tick" : `Share this tick with ${partnerName}`}
                        className={cn("press flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-9", item.visibility === "partner" ? "bg-me-soft text-ink" : "text-muted-foreground hover:bg-muted")}
                      >
                        {item.visibility === "partner" ? <HeartHandshake className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
          </ul>
        </section>
      ))}

      {theirs.length > 0 && partnerName && (
        <section aria-label={`Shared by ${partnerName}`} className="rounded-2xl bg-them-soft p-4">
          <h2 className="font-mono text-caption tracking-[0.07em] text-muted-foreground uppercase">{partnerName} did and shared</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {theirs.map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-label font-normal">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-them text-white">
                  <CheckGlyph className="size-3" />
                </span>
                {i.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

function Tick({ on, busy, label, onClick }: { on: boolean; busy: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy}
      onClick={onClick}
      className="press group -m-1 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <motion.span
        animate={{ backgroundColor: on ? "var(--me)" : "rgba(0,0,0,0)", borderColor: on ? "var(--me)" : "var(--line-2)" }}
        transition={{ duration: duration.base, ease: ease.out }}
        className="flex size-7 items-center justify-center rounded-full border-2"
      >
        <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M3 8.5l3.2 3.2L13 4.8" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: duration.slow, ease: ease.out }} />
        </svg>
      </motion.span>
    </button>
  );
}
