"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PlanItem } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
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
      <div className="mt-8 max-w-2xl rounded-2xl border border-border bg-card px-6 py-8">
        <p className="font-medium">Nothing from the guidelines needs you right now.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We check again whenever your family&apos;s data or the week changes.
        </p>
      </div>
    );
  }

  const rest = items.filter((i) => i.ruleId !== focus.ruleId);

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <div className="flex min-w-0 flex-col gap-3">
        <FocusCard item={focus} selected={selected?.ruleId === focus.ruleId} onSelect={() => setSelectedId(focus.ruleId)} />
        {rest.length > 0 && (
          <>
            <h2 className="mt-4 text-xs font-semibold tracking-[0.07em] text-muted-foreground uppercase">Also on your plan</h2>
            <ul className="flex flex-col gap-2">
              {rest.map((item, i) => (
                <motion.li
                  key={item.ruleId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.04 }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.ruleId)}
                    aria-pressed={selected?.ruleId === item.ruleId}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected?.ruleId === item.ruleId ? "border-primary shadow-[0_0_0_3px_var(--secondary)]" : "border-border hover:border-input",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold">{item.title}</span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">{item.reason}</span>
                    </span>
                    <StatusPill status={item.status} dueBy={item.dueBy} />
                  </button>
                </motion.li>
              ))}
            </ul>
          </>
        )}
      </div>

      {selected && <WhyPanel item={selected} />}
    </div>
  );
}

function FocusCard({ item, selected, onSelect }: { item: PlanItem; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border bg-card px-5 py-5 text-left outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary shadow-[0_0_0_3px_var(--secondary)]" : "border-border hover:border-input",
      )}
    >
      <span className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.07em] text-primary uppercase">
          {item.status === "upcoming" ? "Coming up" : "Your next step"}
        </span>
        <span className="flex-1" />
        <StatusPill status={item.status} dueBy={item.dueBy} />
      </span>
      <span className="mt-2 block text-[19px] font-semibold tracking-[-0.01em]">{item.title}</span>
      <span className="mt-1.5 block text-[14.5px] leading-relaxed">{item.detail}</span>
      <span className="mt-3 block text-[13px] text-muted-foreground">{item.reason}</span>
    </motion.button>
  );
}

function WhyPanel({ item }: { item: PlanItem }) {
  return (
    <section aria-live="polite" className="self-start rounded-2xl border border-border bg-card px-5 py-5 xl:sticky xl:top-6">
      <h2 className="text-xs font-semibold tracking-[0.07em] text-muted-foreground uppercase">Why this is in your plan</h2>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.ruleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <p className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{item.title}</p>
          <Field label="Your data">{item.reason}</Field>
          <Field label="What the guideline says">{item.detail}</Field>
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Source</p>
            <a
              href={item.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 block rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11.5px] leading-relaxed underline-offset-2 hover:underline"
            >
              {item.source.title}
              <span className="block text-muted-foreground">checked {formatLongDate(item.source.checkedAt)}</span>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">This is guidance to discuss with your doctor, not a diagnosis.</p>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed">{children}</p>
    </div>
  );
}
