"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, CheckCircle2, ExternalLink, UserRound, type LucideIcon } from "lucide-react";
import type { PlanItem } from "@/lib/api/types";
import { daysUntil, formatLongDate, formatShortDate } from "@/lib/format";
import { categoryIcon, categoryLabel, statusTint } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status-pill";

// The plan as one focus card plus a quieter list, and a "why" panel for the
// selected item: the parent's data that triggered it, the guideline and its
// source with the date it was checked (docs/design.md, rules 2 and 3).
export function PlanBoard({ items }: { items: PlanItem[] }) {
  const focus = items.find((i) => i.status !== "upcoming") ?? items[0];
  const [selectedId, setSelectedId] = useState(focus?.ruleId);
  const selected = items.find((i) => i.ruleId === selectedId) ?? focus;

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
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <div className="flex min-w-0 flex-col gap-8">
        <FocusCard item={focus} selected={selected?.ruleId === focus.ruleId} onSelect={() => setSelectedId(focus.ruleId)} />
        {rest.length > 0 && (
          <section aria-labelledby="also-title">
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
                  <ItemRow item={item} selected={selected?.ruleId === item.ruleId} onSelect={() => setSelectedId(item.ruleId)} />
                </motion.li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {selected && <WhyPanel item={selected} />}
    </div>
  );
}

const selectable =
  "w-full border bg-card text-left outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50";
const selectedRing = "border-primary shadow-[0_0_0_3px_var(--secondary)]";

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

function FocusCard({ item, selected, onSelect }: { item: PlanItem; selected: boolean; onSelect: () => void }) {
  const days = item.dueBy ? daysUntil(item.dueBy) : undefined;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(selectable, "rounded-2xl p-6", selected ? selectedRing : "border-border hover:border-input")}
    >
      <span className="flex items-start gap-4">
        <ItemIcon item={item} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-caption font-semibold tracking-[0.07em] text-primary uppercase">
            {item.status === "upcoming" ? "Coming up" : "Your next step"}
          </span>
          <span className="mt-1 block text-title">{item.title}</span>
        </span>
        {days !== undefined && item.status !== "overdue" && (
          <span className="shrink-0 text-right">
            <span className="block text-headline tabular-nums">{Math.max(days, 0)}</span>
            <span className="block text-caption text-muted-foreground">{days === 1 ? "day left" : "days left"}</span>
          </span>
        )}
      </span>
      <span className="mt-4 block text-body">{item.detail}</span>
      <span className="mt-4 flex items-center gap-2">
        <StatusPill status={item.status} dueBy={item.dueBy} />
        <span className="text-caption text-muted-foreground">{categoryLabel[item.category]}</span>
      </span>
    </motion.button>
  );
}

function ItemRow({ item, selected, onSelect }: { item: PlanItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(selectable, "flex items-center gap-3 rounded-xl px-4 py-3", selected ? selectedRing : "border-border hover:border-input")}
    >
      <ItemIcon item={item} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">{item.title}</span>
        <span className="block text-caption text-muted-foreground">
          {categoryLabel[item.category]}
          {item.dueBy ? ` · by ${formatShortDate(item.dueBy)}` : ""}
        </span>
      </span>
      <StatusPill status={item.status} />
    </button>
  );
}

function WhyPanel({ item }: { item: PlanItem }) {
  return (
    <section aria-live="polite" aria-labelledby="why-title" className="self-start rounded-2xl border border-border bg-card p-5 xl:sticky xl:top-6">
      <h2 id="why-title" className="text-title">
        Why it&apos;s in your plan
      </h2>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={item.ruleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="mt-4 flex flex-col"
        >
          <Step icon={UserRound} label="Your data">
            <p className="text-body">{item.reason}</p>
          </Step>
          <Step icon={BookOpen} label="The guideline">
            <p className="text-body">{item.detail}</p>
          </Step>
          <Step icon={ExternalLink} label="Source" last>
            <a
              href={item.source.url}
              target="_blank"
              rel="noreferrer"
              className="block font-mono text-caption underline-offset-2 hover:underline"
            >
              {item.source.title}
            </a>
            <p className="mt-1 font-mono text-caption text-muted-foreground">checked {formatLongDate(item.source.checkedAt)}</p>
          </Step>
        </motion.ol>
      </AnimatePresence>
      <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
        Guidance to discuss with your doctor, not a diagnosis.
      </p>
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
