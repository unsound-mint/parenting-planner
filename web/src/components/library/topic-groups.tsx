"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Rise } from "@/components/joy/rise";
import type { LibraryStage } from "@/lib/api/types";
import { byRelevance, counts, type LibraryItem, stageLabels, stageOrder } from "./catalogue";
import { LibraryCard } from "./library-card";
import { useSavable } from "./use-savable";
import { tileGrid } from "./library-shelves";
import { categoryOf } from "./visuals";

const GROUP = 12;

/**
 * One topic's shelf in full, grouped by stage (the family's own first, then
 * life order), each group counted and showing twelve tiles until asked for
 * the rest. An item spanning stages sits in the family's stage if it covers
 * it, otherwise in its earliest one, so nothing is listed twice.
 */
export function TopicGroups({ memberId, category, items: initial, stage }: { memberId: string; category: string; items: LibraryItem[]; stage: LibraryStage }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [items, save] = useSavable(memberId, initial);
  const { label, icon: Icon } = categoryOf(category);
  const c = counts(items);
  const groups = new Map<LibraryStage, LibraryItem[]>();
  for (const i of byRelevance(items, stage)) {
    const g = i.stages.includes(stage) ? stage : (i.stages[0] ?? stage);
    groups.set(g, [...(groups.get(g) ?? []), i]);
  }
  const order = [stage, ...stageOrder.filter((s) => s !== stage)].filter((s) => groups.has(s));

  return (
    <>
      <Rise as="header" i={0} className="flex flex-col gap-3">
        <Link href={`/family/${memberId}/learn/library`} className="press inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full pr-3 text-label text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Library
        </Link>
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-me-soft text-me">
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-headline">{label}</h1>
            <p className="text-body text-ink-2">
              {c.ready} to read{c.soon > 0 && `, ${c.soon} coming soon`}, in {order.length} {order.length === 1 ? "stage" : "stages"}
            </p>
          </div>
        </div>
        <nav aria-label="Stages" className="flex flex-wrap gap-2">
          {order.map((s) => (
            <a key={s} href={`#stage-${s}`} className="press inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-3.5 text-label text-ink-2 ring-1 ring-line hover:ring-line-2">
              {stageLabels[s]}
              <span className="font-mono text-caption text-muted-foreground">{groups.get(s)!.length}</span>
            </a>
          ))}
        </nav>
      </Rise>
      {order.map((s, n) => {
        const list = groups.get(s)!;
        const all = open[s] || list.length <= GROUP + 3;
        return (
          <Rise as="section" key={s} i={Math.min(n + 1, 4)} id={`stage-${s}`} aria-labelledby={`stage-${s}-title`} className="flex scroll-mt-6 flex-col gap-3">
            <h2 id={`stage-${s}-title`} className="flex items-baseline gap-2 text-title">
              {stageLabels[s]}
              {s === stage && <span className="rounded-full bg-sun px-2 py-0.5 text-caption font-semibold text-ink-2">You are here</span>}
              <span className="font-mono text-caption text-muted-foreground">{list.length}</span>
            </h2>
            <ul className={tileGrid}>
              {(all ? list : list.slice(0, GROUP)).map((i) => (
                <LibraryCard key={i.id} item={i} onSave={save} />
              ))}
            </ul>
            {!all && (
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [s]: true }))} className="press min-h-11 w-fit rounded-full border border-line-2 px-4 text-label text-ink-2 hover:bg-muted">
                Show all {list.length}
              </button>
            )}
          </Rise>
        );
      })}
    </>
  );
}
