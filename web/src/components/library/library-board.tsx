"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Rise } from "@/components/joy/rise";
import { SoftCard } from "@/components/joy/soft-card";
import { StageMascot } from "@/components/illustrations";
import type { LibraryTopicSummary, Stage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AskPrivately } from "./ask-privately";
import { TopicCard } from "./topic-card";
import { categoryOf, categoryOrder, words } from "./visuals";

const NOW_SHOWN = 8;
const SOON_SHOWN = 5;
const RESULTS_SHOWN = 40;

/**
 * The Questions library. The hero says where the family is and holds the
 * search; below it, what parents ask right now, what is coming up, and a
 * private question of their own. Search and category chips filter instantly
 * (typing is too frequent to animate); a topic opens in place.
 */
export function LibraryBoard({
  memberId,
  stage,
  position,
  items,
  initialTopic,
  initialQuery = "",
}: {
  memberId: string;
  stage: Stage;
  position: string;
  items: LibraryTopicSummary[];
  initialTopic?: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(initialTopic ?? null);
  const [more, setMore] = useState({ now: false, soon: false, results: false });

  const index = useMemo(() => items.map((t) => ({ t, words: new Set(words([t.title, ...t.questions, categoryOf(t.category).label].join(" "))) })), [items]);
  const categories = useMemo(() => {
    const present = new Set(items.map((t) => t.category));
    return categoryOrder.filter((c) => present.has(c)).concat([...present].filter((c) => !categoryOrder.includes(c)));
  }, [items]);

  const terms = words(query);
  const filtering = terms.length > 0 || category !== null;
  const results = filtering
    ? index
        .filter(({ t, words: w }) => (category === null || t.category === category) && terms.every((q) => [...w].some((x) => x.startsWith(q))))
        .map(({ t }) => t)
    : [];

  const now = items.filter((t) => t.now);
  const soon = items.filter((t) => t.soon);
  // A topic opened from a link (This week, a related chip) may sit outside the shown slice.
  const pinned = open && !filtering ? items.find((t) => t.id === open && !t.now && !t.soon) : undefined;

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const openRelated = (id: string) => {
    setQuery("");
    setCategory(null);
    setOpen(id);
  };
  const card = (t: LibraryTopicSummary) => <TopicCard key={t.id} memberId={memberId} topic={t} open={open === t.id} onToggle={() => toggle(t.id)} onOpenRelated={openRelated} />;
  const slice = (list: LibraryTopicSummary[], n: number, all: boolean) => {
    const shown = all ? list : list.slice(0, n);
    // Keep an opened topic visible even when it is past the cut.
    const o = list.find((t) => t.id === open);
    return o && !shown.includes(o) ? [...shown, o] : shown;
  };

  return (
    <>
      <Rise i={0}>
        <SoftCard tone="sun" hero className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_14rem] @7xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <p className="text-caption font-semibold tracking-wider text-ink-2 uppercase">Questions parents ask</p>
              <h1 className="mt-2 text-display text-balance">
                {position}: <em className="text-me">what others wonder too</em>
              </h1>
              <p className="mt-3 max-w-prose text-body text-ink-2">
                {items.length} topics in plain words, each with its source and how strong the evidence is. Your own situation goes to your own clinician.
              </p>
            </div>
            <div className="relative max-w-2xl">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: hiccups, car seat, crisis of 3, circumcision..."
                aria-label="Search questions"
                className="h-14 w-full rounded-full border border-line-2 bg-card pr-12 pl-12 text-body outline-none placeholder:text-muted-foreground focus-visible:border-me focus-visible:ring-3 focus-visible:ring-me/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="press absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="size-4.5" aria-hidden />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
              {categories.map((c) => {
                const { label, icon: Icon } = categoryOf(c);
                const on = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(on ? null : c)}
                    className={cn(
                      "press inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-label transition-colors duration-(--duration-fast)",
                      on ? "bg-me text-white" : "bg-card/80 text-ink-2 hover:bg-card",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden aspect-[300/260] self-end @4xl:block" aria-hidden>
            <StageMascot stage={stage} />
          </div>
        </SoftCard>
      </Rise>

      {filtering ? (
        <Rise as="section" i={1} aria-labelledby="results-title" className="flex flex-col gap-4">
          <h2 id="results-title" className="text-headline">
            {results.length === 0
              ? "No topic matches that yet"
              : `${results.length} ${results.length === 1 ? "topic" : "topics"}${category ? ` on ${categoryOf(category).label.toLowerCase()}` : ""}`}
          </h2>
          {results.length === 0 ? (
            <SoftCard tone="me" className="max-w-3xl">
              <p className="text-title">Ask it privately instead</p>
              <p className="mt-1 mb-4 text-label font-normal text-ink-2">It goes to your next appointment, where someone who knows you can answer it.</p>
              <AskPrivately memberId={memberId} initial={query} />
            </SoftCard>
          ) : (
            <Columns list={slice(results, RESULTS_SHOWN, more.results)} render={card} />
          )}
          {results.length > RESULTS_SHOWN && !more.results && <ShowMore n={results.length - RESULTS_SHOWN} onClick={() => setMore((m) => ({ ...m, results: true }))} />}
        </Rise>
      ) : (
        <div className="grid min-w-0 items-start gap-6 @4xl:grid-cols-2 @7xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24rem]">
          <Rise as="section" i={1} aria-labelledby="now-title" className="flex min-w-0 flex-col gap-3">
            <SectionTitle id="now-title" title="For where you are now" count={now.length} />
            <ul className="flex flex-col gap-3">
              {pinned && card(pinned)}
              {slice(now, NOW_SHOWN, more.now).map(card)}
            </ul>
            {now.length > NOW_SHOWN && !more.now && <ShowMore n={now.length - NOW_SHOWN} onClick={() => setMore((m) => ({ ...m, now: true }))} />}
          </Rise>
          <Rise as="section" i={2} aria-labelledby="soon-title" className="flex min-w-0 flex-col gap-3">
            <SectionTitle id="soon-title" title="Coming up in the next months" count={soon.length} />
            <ul className="flex flex-col gap-3">{slice(soon, SOON_SHOWN, more.soon).map(card)}</ul>
            {soon.length > SOON_SHOWN && !more.soon && <ShowMore n={soon.length - SOON_SHOWN} onClick={() => setMore((m) => ({ ...m, soon: true }))} />}
          </Rise>
          <Rise as="aside" i={3} aria-labelledby="ask-title" className="min-w-0 @4xl:col-span-2 @7xl:col-span-1">
            <SoftCard tone="me">
              <h2 id="ask-title" className="text-title">
                Your own question
              </h2>
              <p className="mt-1 mb-4 text-label font-normal text-ink-2">Write it once. It waits, private, for your next visit or your psychologist session.</p>
              <AskPrivately memberId={memberId} feelings />
            </SoftCard>
          </Rise>
        </div>
      )}
    </>
  );
}

function SectionTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 text-headline">
      {title}
      <span className="font-mono text-caption text-muted-foreground">{count}</span>
    </h2>
  );
}

function ShowMore({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press min-h-11 w-fit rounded-full border border-line-2 px-4 text-label text-ink-2 transition-colors duration-(--duration-fast) hover:bg-muted">
      Show {n} more
    </button>
  );
}

/** Results in two or three independent columns, split in reading order, so an opened topic only moves its own column. */
function Columns({ list, render }: { list: LibraryTopicSummary[]; render: (t: LibraryTopicSummary) => React.ReactNode }) {
  const half = Math.ceil(list.length / 2);
  return (
    <div className="grid min-w-0 items-start gap-3 @4xl:grid-cols-2 @4xl:gap-6">
      <ul className="flex min-w-0 flex-col gap-3">{list.slice(0, half).map(render)}</ul>
      <ul className="flex min-w-0 flex-col gap-3">{list.slice(half).map(render)}</ul>
    </div>
  );
}
