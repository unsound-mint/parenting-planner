"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import type { LibraryStage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  byRelevance,
  counts,
  type Format,
  formatLabels,
  type Length,
  lengthLabels,
  lengthOf,
  type LibraryItem,
  shelvesOf,
  stageLabels,
  stageOrder,
} from "./catalogue";
import { LibraryCard } from "./library-card";
import { categoryOf, words } from "./visuals";

const SHELF = 6;
const RESULTS = 24;

/** Tiles in a grid that grows columns with the screen instead of stretching them. */
export const tileGrid = "grid min-w-0 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-6";

/**
 * The Learn library: a hero with honest counts and the search, filter chips
 * for stage, format and length, then one shelf per topic with six tiles and
 * "See all". Filtering swaps the shelves for one counted result list (a page
 * at a time, never an endless scroll). Typing filters instantly, unanimated.
 */
export function LibraryShelves({ memberId, items, stage, position }: { memberId: string; items: LibraryItem[]; stage: LibraryStage; position: string }) {
  const [query, setQuery] = useState("");
  const [stages, setStages] = useState<LibraryStage | null>(null);
  const [format, setFormat] = useState<Format | null>(null);
  const [length, setLength] = useState<Length | null>(null);
  const [shown, setShown] = useState(RESULTS);

  const total = counts(items);
  const shelves = useMemo(() => shelvesOf(items, stage), [items, stage]);
  const terms = words(query);
  const filtering = terms.length > 0 || stages !== null || format !== null || length !== null;
  const results = useMemo(
    () =>
      filtering
        ? byRelevance(
            items.filter(
              (i) =>
                (stages === null || i.stages.includes(stages)) &&
                (format === null || i.format === format) &&
                (length === null || lengthOf(i.minutes) === length) &&
                terms.every((q) => i.words.some((w) => w.startsWith(q))),
            ),
            stages ?? stage,
          )
        : [],
    // terms is derived from query on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtering, items, stages, format, length, query, stage],
  );
  const found = counts(results);
  const reset = () => {
    setQuery("");
    setStages(null);
    setFormat(null);
    setLength(null);
  };

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero className="flex flex-col gap-5">
          <div>
            <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">Library</p>
            <h1 className="mt-2 text-display text-balance">
              {total.ready} to read now, <em className="text-me">{total.soon} coming soon</em>
            </h1>
            <p className="mt-3 max-w-prose text-body text-ink-2">
              Sorted for where you are: {position}. Every article cites the pages it comes from; coming-soon titles show what we are writing next and do not open yet.
            </p>
          </div>
          <div className="relative max-w-3xl">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(RESULTS);
              }}
              placeholder="Search: car seat, tantrums, maternity leave..."
              aria-label="Search the library"
              className="h-14 w-full rounded-full border border-line-2 bg-card pr-12 pl-12 text-body outline-none placeholder:text-muted-foreground focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="press absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                <X className="size-4.5" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 @4xl:flex-row @4xl:flex-wrap @4xl:items-center @4xl:gap-x-6">
            <Chips label="Stage" options={stageOrder.map((s) => [s, stageLabels[s]] as const)} value={stages} onChange={(v) => (setStages(v), setShown(RESULTS))} mark={stage} />
            <Chips label="Format" options={(Object.keys(formatLabels) as Format[]).map((f) => [f, formatLabels[f]] as const)} value={format} onChange={(v) => (setFormat(v), setShown(RESULTS))} />
            <Chips label="Length" options={(Object.keys(lengthLabels) as Length[]).map((l) => [l, lengthLabels[l]] as const)} value={length} onChange={(v) => (setLength(v), setShown(RESULTS))} />
          </div>
        </SoftCard>
      </Rise>

      {filtering ? (
        <Rise as="section" i={1} aria-labelledby="results-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id="results-title" className="text-headline">
              {results.length === 0 ? "Nothing matches yet" : `${found.ready} to read${found.soon ? `, ${found.soon} coming soon` : ""}`}
            </h2>
            <button type="button" onClick={reset} className="press text-label text-me underline-offset-4 hover:underline">
              Clear filters
            </button>
          </div>
          {results.length > 0 && <ul className={tileGrid}>{results.slice(0, shown).map((i) => <LibraryCard key={i.id} item={i} />)}</ul>}
          {results.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + RESULTS)} className="press min-h-11 w-fit rounded-full border border-line-2 px-4 text-label text-ink-2 hover:bg-muted">
              Show {Math.min(RESULTS, results.length - shown)} more of {results.length - shown}
            </button>
          )}
        </Rise>
      ) : (
        shelves.map((s, n) => <Shelf key={s.category} memberId={memberId} category={s.category} items={s.items} i={Math.min(n + 1, 4)} />)
      )}
    </>
  );
}

function Shelf({ memberId, category, items, i }: { memberId: string; category: string; items: LibraryItem[]; i: number }) {
  const { label, icon: Icon } = categoryOf(category);
  const c = counts(items);
  return (
    <Rise as="section" i={i} aria-labelledby={`shelf-${category}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-me-soft text-me">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`shelf-${category}`} className="text-headline">
            {label}
          </h2>
          <p className="text-caption text-muted-foreground">
            {c.ready > 0 ? `${c.ready} to read` : "Nothing to read yet"}
            {c.soon > 0 && `, ${c.soon} coming soon`}
          </p>
        </div>
        {items.length > SHELF && (
          <Link
            href={`/family/${memberId}/learn/library/${encodeURIComponent(category)}`}
            className="press ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-label text-me transition-colors duration-(--duration-fast) hover:bg-me-soft"
          >
            See all {items.length}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {/* Three tiles on a phone, six from two columns up: a shelf is a taste, See all is the list. */}
      <ul className={cn(tileGrid, "@max-xl:[&>li:nth-child(n+4)]:hidden")}>
        {items.slice(0, SHELF).map((it) => (
          <LibraryCard key={it.id} item={it} />
        ))}
      </ul>
    </Rise>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  mark,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (v: T | null) => void;
  /** The family's own option, dotted. */
  mark?: T;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="w-14 shrink-0 text-caption font-semibold text-ink-2">{label}</span>
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : v)}
            className={cn(
              "press inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-(--duration-fast)",
              on ? "bg-me text-white" : "bg-card/80 text-ink-2 hover:bg-card",
            )}
          >
            {mark === v && <span className={cn("size-1.5 rounded-full", on ? "bg-white" : "bg-me")} aria-label="(you are here)" />}
            {text}
          </button>
        );
      })}
    </div>
  );
}
