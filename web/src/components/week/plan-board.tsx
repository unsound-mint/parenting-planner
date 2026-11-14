"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BookOpen, CalendarCheck, CheckCircle2, ChevronDown, ExternalLink, UserRound, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PlanItem } from "@/lib/api/types";
import { BOOKING_ENABLED } from "@/lib/features";
import { daysUntil, firstSentence, formatLongDate, formatShortDate } from "@/lib/format";
import { categoryIcon, categoryLabel, statusBar, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./status-pill";

// The plan as one focus card plus a quieter list. Each item explains itself
// in place: "Why?" opens under the item and adds only what the item does not
// already say (the parent's data, the rest of the guideline, the source with
// its checked date), so nothing on the page is printed twice.
export function PlanBoard({ items, memberId }: { items: PlanItem[]; memberId: string }) {
  const focus = items.find((i) => i.status !== "upcoming") ?? items[0];
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((o) => (o === id ? null : id));

  if (!focus) {
    return (
      <div className="mt-8 flex max-w-2xl items-center gap-4 rounded-2xl border border-border bg-card p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-ok-soft text-status-ok">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-title">Nothing from the guidelines needs you right now</p>
          <p className="text-label text-muted-foreground">We check again when your family&apos;s data or the week changes.</p>
        </div>
      </div>
    );
  }

  const rest = items.filter((i) => i.ruleId !== focus.ruleId);

  return (
    <div className="mt-8 flex min-w-0 flex-col gap-6">
      <FocusCard item={focus} memberId={memberId} whyOpen={openId === focus.ruleId} onToggleWhy={() => toggle(focus.ruleId)} />
      {rest.length > 0 && (
        <section aria-labelledby="also-title" className="mt-2">
          <h2 id="also-title" className="text-title">
            Also on your plan
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {rest.map((item, i) => (
              <motion.li
                key={item.ruleId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + i * 0.04 }}
              >
                <ItemRow item={item} open={openId === item.ruleId} onToggle={() => toggle(item.ruleId)} />
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemIcon({ item, size }: { item: PlanItem; size: "md" | "lg" }) {
  const Icon = categoryIcon[item.category];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        statusTint[item.status],
        size === "lg" ? "size-12" : "size-9",
      )}
    >
      <Icon className={size === "lg" ? "size-6" : "size-4.5"} aria-hidden />
    </span>
  );
}

// Window for the countdown bar: items further out than this fill the track.
const COUNTDOWN_DAYS = 56;

function FocusCard({ item, memberId, whyOpen, onToggleWhy }: { item: PlanItem; memberId: string; whyOpen: boolean; onToggleWhy: () => void }) {
  const router = useRouter();
  const [booked, setBooked] = useState(false);
  const [pending, startTransition] = useTransition();
  const days = item.dueBy ? daysUntil(item.dueBy) : undefined;
  const progress = booked ? "booked" : item.progress;

  function markBooked() {
    startTransition(async () => {
      const { error } = await api.PUT("/members/{memberId}/plan/{ruleId}/status", {
        params: { path: { memberId, ruleId: item.ruleId } },
        body: { status: "booked" },
      });
      if (error) {
        toast.error("Could not save that. Please try again.");
        return;
      }
      setBooked(true);
      router.refresh();
    });
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.32, bounce: 0 }}
      aria-labelledby="focus-title"
      className="rounded-2xl border border-primary bg-card p-6 shadow-[0_0_0_3px_var(--secondary)]"
    >
      <div className="flex items-start gap-4">
        <ItemIcon item={item} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold tracking-[0.07em] text-primary uppercase">
            {item.status === "upcoming" ? "Coming up" : "Your next step"}
          </p>
          <h2 id="focus-title" className="mt-1 text-title">
            {item.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-body">{firstSentence(item.detail)}</p>
        </div>
      </div>

      {days !== undefined && item.status !== "overdue" && <Countdown item={item} days={Math.max(days, 0)} />}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <StatusPill status={item.status} />
        <span className="text-caption text-muted-foreground">{categoryLabel[item.category]}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleWhy}
            aria-expanded={whyOpen}
            aria-controls={`why-${item.ruleId}`}
            className="h-11 px-3 text-label md:h-9"
          >
            Why?
            <ChevronDown className={cn("size-4 transition-transform duration-220", whyOpen && "rotate-180")} aria-hidden />
          </Button>
          {BOOKING_ENABLED && !progress && (
            <Button type="button" onClick={markBooked} disabled={pending} className="h-11 px-4 text-label md:h-9">
              <CalendarCheck aria-hidden />
              {pending ? "Saving..." : "Mark as booked"}
            </Button>
          )}
          {progress && (
            <motion.span
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.32, bounce: 0 }}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-status-ok-soft px-3 text-label font-semibold text-status-ok md:h-9"
            >
              <CheckCircle2 className="size-4" aria-hidden />
              {progress === "done" ? "Done" : "Booked"}
            </motion.span>
          )}
        </div>
      </div>
      <Why id={`why-${item.ruleId}`} item={item} open={whyOpen} skipFirstSentence />
    </motion.article>
  );
}

// A small lane like the ones on Journey: today on the left, the due date as a
// marker, the bar as the time left. The number repeats it for screen readers.
function Countdown({ item, days }: { item: PlanItem; days: number }) {
  const Icon = categoryIcon[item.category];
  const end = Math.max(0.04, Math.min(1, days / COUNTDOWN_DAYS));
  return (
    <div className="mt-5">
      <div className="relative h-7" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-muted" />
        <span className="absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
        <motion.span
          className={cn("absolute top-1/2 left-0 h-3.5 origin-left -translate-y-1/2 rounded-full opacity-80", statusBar[item.status])}
          style={{ width: `${end * 100}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.32, delay: 0.1 }}
        />
        <span
          className={cn("absolute top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card", statusTint[item.status])}
          style={{ left: `calc(${end * 100}% - ${end * 28}px)` }}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 flex justify-between font-mono text-caption text-muted-foreground">
        <span>Today</span>
        <span>
          {item.dueBy ? `${formatShortDate(item.dueBy)} · ` : ""}
          {days} {days === 1 ? "day" : "days"}
        </span>
      </p>
    </div>
  );
}

function ItemRow({ item, open, onToggle }: { item: PlanItem; open: boolean; onToggle: () => void }) {
  return (
    <div className={cn("rounded-xl border bg-card transition-colors duration-150", open ? "border-input" : "border-border")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`why-${item.ruleId}`}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ItemIcon item={item} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">{item.title}</span>
          <span className="block text-caption text-muted-foreground">
            {categoryLabel[item.category]}
            {item.dueBy ? ` · by ${formatShortDate(item.dueBy)}` : ""}
          </span>
        </span>
        {item.progress ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-ok-soft px-2 py-0.5 text-caption font-semibold text-status-ok">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {item.progress === "done" ? "Done" : "Booked"}
          </span>
        ) : (
          <StatusPill status={item.status} />
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-220", open && "rotate-180")} aria-hidden />
      </button>
      <div className="px-4">
        <Why id={`why-${item.ruleId}`} item={item} open={open} className="pb-4" />
      </div>
    </div>
  );
}

// Opens and closes with a grid-rows transition (0fr to 1fr) plus a fade, so
// the content below slides instead of jumping. Closed content is inert.
// skipFirstSentence: the focus card already shows the guideline's first
// sentence as its action, so the guideline step only adds what follows it.
function Why({ id, item, open, skipFirstSentence, className }: { id: string; item: PlanItem; open: boolean; skipFirstSentence?: boolean; className?: string }) {
  const guideline = skipFirstSentence ? item.detail.slice(firstSentence(item.detail).length).trim() : item.detail;
  return (
    <section
      id={id}
      aria-label={`Why ${item.title} is in your plan`}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-220 ease-(--ease-out)",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <ol className="mt-5 flex flex-col border-t border-border pt-5">
          <Step icon={UserRound} label="Your data">
            <p className="text-body">{item.reason}</p>
          </Step>
          {guideline && (
            <Step icon={BookOpen} label="The guideline">
              <p className="text-body">{guideline}</p>
            </Step>
          )}
          <Step icon={ExternalLink} label="Source" last>
            <a href={item.source.url} target="_blank" rel="noreferrer" className="block font-mono text-caption underline-offset-2 hover:underline">
              {item.source.title}
            </a>
            <p className="mt-1 font-mono text-caption text-muted-foreground">checked {formatLongDate(item.source.checkedAt)}</p>
          </Step>
        </ol>
        <p className={cn("mt-4 text-caption text-muted-foreground", className)}>Guidance to discuss with your doctor, not a diagnosis.</p>
      </div>
    </section>
  );
}

// One step of the "why" chain: an icon on a connecting line, then its content.
function Step({ icon: Icon, label, last, children }: { icon: LucideIcon; label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        {!last && <span aria-hidden className="w-px flex-1 bg-border" />}
      </span>
      <div className={cn("min-w-0 flex-1 pt-1.5", !last && "pb-4")}>
        <p className="text-label font-semibold text-muted-foreground">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
