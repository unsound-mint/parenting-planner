"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Star, X } from "lucide-react";
import type { DiaryEntry } from "@/lib/api/types";
import { formatDayNumber, formatMonth } from "@/lib/format";
import { spring } from "@/components/joy/motion";
import { cn } from "@/lib/utils";

type Filter = "all" | "firsts" | "shared";

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });

/**
 * The journal as an archive that stays easy to read after years: newest first,
 * a header per month, "Show older" for the next page (GET diary-entries with
 * before), a search over the loaded text and three views. "Firsts" asks the
 * server for every entry marked as a first (first=true), however old, and
 * opens with a timeline of them so a family can check its firsts months later
 * and jump to one to correct it. Search runs in the browser because the text
 * is encrypted at rest; it covers the entries loaded so far and says so.
 *
 * The entries live in the parent island (JournalAndCare) so edits made here
 * reach the brief too; this component only asks it to merge older pages.
 */
export function JournalArchive({
  memberId,
  entries,
  nextBefore,
  firstsLoaded,
  loading,
  onOlder,
  onFirsts,
  onJump,
  row,
}: {
  memberId: string;
  /** Every entry loaded so far, any order. */
  entries: DiaryEntry[];
  /** Cursor for the next page of all entries; none when the oldest is loaded. */
  nextBefore?: string;
  /** True once every first has been read from the server. */
  firstsLoaded: boolean;
  loading: boolean;
  onOlder: () => void;
  onFirsts: () => void;
  onJump: (id: string) => void;
  row: (e: DiaryEntry) => ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => {
        // In "all", only the contiguous run of pages: firsts fetched from further back
        // wait until "Show older" reaches them, so no month looks half empty.
        if (filter === "all" && nextBefore && Date.parse(e.writtenAt) < Date.parse(nextBefore)) return false;
        if (filter === "firsts" && !e.first) return false;
        if (filter === "shared" && e.visibility === "private") return false;
        return !q || e.body.toLowerCase().includes(q) || (e.agendaTopic ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt));
  }, [entries, filter, query, nextBefore]);

  const months = useMemo(() => {
    const out: { key: string; label: string; items: DiaryEntry[] }[] = [];
    for (const e of shown) {
      const label = monthYear.format(new Date(e.writtenAt));
      const last = out.at(-1);
      if (last?.label === label) last.items.push(e);
      else out.push({ key: label, label, items: [e] });
    }
    return out;
  }, [shown]);

  const firsts = filter === "firsts" ? [...shown].reverse() : [];
  const moreToLoad = filter === "firsts" ? !firstsLoaded : Boolean(nextBefore);

  function pick(f: Filter) {
    setFilter(f);
    if (f === "firsts" && !firstsLoaded) onFirsts();
  }

  return (
    <section aria-labelledby="journal-archive" className="mt-3 flex flex-col gap-4">
      <h2 id="journal-archive" className="sr-only">
        Your entries
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="flex rounded-full bg-muted p-1">
          {(
            [
              ["all", "All"],
              ["firsts", "Firsts"],
              ["shared", "Shared"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => pick(f)}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-label transition-colors duration-150",
                filter === f ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {filter === f && <motion.span layoutId={`archive-tab-${memberId}`} transition={spring.ui} className="absolute inset-0 rounded-full bg-card shadow-sm" />}
              <span className="relative inline-flex items-center gap-1.5">
                {f === "firsts" && <Star className="size-3.5" aria-hidden />}
                {label}
              </span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto min-w-0 flex-1 basis-48 @md:max-w-72">
          <span className="sr-only">Search your journal</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries"
            className="h-9 w-full rounded-full border border-line bg-card pr-8 pl-9 text-label outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-ink">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
      </div>

      {firsts.length > 0 && !query && (
        <ol aria-label="Your firsts, oldest first" className="flex gap-2 overflow-x-auto pb-1">
          {firsts.map((e) => (
            <li key={e.id} className="shrink-0">
              <button
                onClick={() => onJump(e.id)}
                className="flex max-w-56 flex-col items-start gap-0.5 rounded-2xl border border-line bg-butter/40 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-butter/70"
              >
                <span className="font-mono text-caption text-ink-2">
                  {formatMonth(e.writtenAt)} {formatDayNumber(e.writtenAt)}, {yearFmt.format(new Date(e.writtenAt))}
                </span>
                <span className="line-clamp-1 text-label text-ink">{e.body}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {months.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-2 px-5 py-4 text-label font-normal text-ink-2">
          {query
            ? moreToLoad
              ? `Nothing in the entries loaded so far matches "${query.trim()}". Older entries may.`
              : `No entry matches "${query.trim()}".`
            : filter === "firsts"
              ? loading
                ? "Finding your firsts..."
                : "No firsts yet. Mark an entry as a first when you write it, or with the star on an old one."
              : "Nothing shared yet. Each entry stays yours until you share it."}
        </p>
      ) : (
        months.map((m) => (
          <div key={m.key} className="flex flex-col gap-3">
            <h3 className="sticky top-0 z-10 -mx-1 bg-background/90 px-1 py-1 text-label text-ink-2 backdrop-blur">
              {m.label}
              <span className="ml-2 font-mono text-caption text-muted-foreground">{m.items.length}</span>
            </h3>
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {m.items.map((e) => (
                  <motion.li
                    key={e.id}
                    layout="position"
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={spring.ui}
                  >
                    {row(e)}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ))
      )}

      {filter !== "firsts" && nextBefore && (
        <button
          onClick={onOlder}
          disabled={loading}
          className="self-center rounded-full border border-line bg-card px-4 py-2 text-label text-ink transition-colors duration-150 hover:bg-muted disabled:opacity-60"
        >
          {loading ? "Loading..." : `Show entries before ${formatMonth(nextBefore)} ${formatDayNumber(nextBefore)}, ${yearFmt.format(new Date(nextBefore))}`}
        </button>
      )}
    </section>
  );
}
