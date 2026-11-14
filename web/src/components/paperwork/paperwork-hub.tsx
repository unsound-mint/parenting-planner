"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { FamilyPaperwork, PaperworkItem } from "@/lib/api/types";
import type { Person } from "@/lib/roles";
import { formatShortDate } from "@/lib/format";
import { PageFrame } from "@/components/shell/page";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { duration, ease } from "@/components/joy/motion";
import { BenefitsFinderCard } from "./benefits";
import { Checklist } from "./checklist";
import { daysFrom, leftWords } from "./days";
import { PaperworkArt } from "./paperwork-art";
import { RightsAcademy } from "./rights";

/** The first open step: the API sorts soonest deadline first and undated last. */
export function nextStep(items: PaperworkItem[]): PaperworkItem | undefined {
  return items.find((i) => !i.task.done);
}

const phaseLine = {
  before: "Before the birth, a few steps have a clock. Most of the rest wait for the baby.",
  newborn: "The first weeks have the most forms. Take them one at a time.",
  later: "Little is time-bound now. Keep the rest within reach.",
} as const;

export function PaperworkHub({ hub, people, selfId, childName }: { hub: FamilyPaperwork; people: Person[]; selfId: string; childName?: string }) {
  const [items, setItems] = useState(hub.items);
  const next = nextStep(items);
  const done = items.filter((i) => i.task.done).length;

  async function toggle(item: PaperworkItem) {
    const before = items;
    const done = !item.task.done;
    const mark = (it: PaperworkItem, task: PaperworkItem["task"]) => items.map((x) => (x.key === it.key ? { ...x, task } : x));
    setItems(mark(item, { ...item.task, done, doneById: done ? selfId : undefined }));
    const { data, error } = await api.PATCH("/members/{memberId}/tasks/{taskId}", { params: { path: { memberId: selfId, taskId: item.task.id } }, body: { done } });
    if (error || !data) {
      setItems(before);
      toast.error("Could not save that. Please try again.");
      return;
    }
    setItems((all) => all.map((x) => (x.key === item.key ? { ...x, task: data } : x)));
  }

  const days = next?.task.dueOn ? daysFrom(hub.today, next.task.dueOn) : undefined;
  const headline = !next
    ? `Every paperwork step is ticked${childName ? ` for ${childName}` : ""}.`
    : days !== undefined && next.basis === "official"
      ? `Next: ${next.task.title.toLowerCase()}, ${leftWords(days)}.`
      : `Next: ${next.task.title.toLowerCase()}.`;

  return (
    <PageFrame>
      <Rise i={0}>
        <SoftCard tone="sun" hero as="section" aria-labelledby="paperwork-title" className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0">
            <p className="font-mono text-caption tracking-wide text-ink-2 uppercase">Family paperwork</p>
            <h1 id="paperwork-title" className="mt-2 max-w-2xl text-display text-balance">
              {headline}
            </h1>
            <p className="mt-3 max-w-xl text-body text-ink-2">
              {phaseLine[hub.phase]}
              {next?.task.dueOn && hub.anchorOn && days !== undefined && <> Dates count from {hub.anchorKind === "birth_date" ? "the birth" : "the due date"} ({formatShortDate(hub.anchorOn)}).</>}
            </p>
            <div className="mt-5 flex max-w-md items-center gap-3">
              <div role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label="Paperwork steps done" className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper/70">
                <motion.div
                  className="h-full origin-left rounded-full bg-leaf"
                  initial={false}
                  animate={{ scaleX: items.length ? done / items.length : 0 }}
                  transition={{ duration: duration.slow, ease: ease.inOut }}
                />
              </div>
              <p className="font-mono text-label whitespace-nowrap">
                {done} of {items.length}
              </p>
            </div>
          </div>
          <PaperworkArt className="hidden w-full md:block" />
        </SoftCard>
      </Rise>

      <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] @7xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)]">
        <Rise i={1} as="section" aria-labelledby="checklist-title" className="min-w-0 @7xl:row-span-1">
          <h2 id="checklist-title" className="mb-3 text-headline">
            The checklist
          </h2>
          <p className="mb-4 text-label text-muted-foreground">Either of you can tick a step. Tap a step to see why it matters and how to do it.</p>
          <Checklist items={items} today={hub.today} people={people} nextKey={next?.key} onToggle={toggle} />
        </Rise>
        <Rise i={2} className="min-w-0">
          <RightsAcademy cards={hub.rights} state={hub.statePointer} memberId={selfId} showLeavePlanner={hub.phase !== "later"} />
        </Rise>
        <Rise i={3} className="min-w-0 @5xl:col-span-2 @7xl:col-span-1">
          <BenefitsFinderCard finder={hub.benefits} memberId={selfId} />
        </Rise>
      </div>
    </PageFrame>
  );
}
