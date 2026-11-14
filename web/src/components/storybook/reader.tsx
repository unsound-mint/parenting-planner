"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Printer, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import type { Story, StoryArt as Art } from "@/lib/api/types";
import { ease } from "@/components/joy/motion";
import { cn } from "@/lib/utils";
import { StoryArt } from "./story-art";
import "./storybook.css";

type Leaf = { kind: "cover" | "page" | "end"; text: string; art: Art };

function leaves(story: Story): Leaf[] {
  return [
    { kind: "cover", text: story.title, art: story.pages[0]?.art ?? "hearts" },
    ...story.pages.map((p) => ({ kind: "page" as const, text: p.text, art: p.art })),
    { kind: "end", text: "The end", art: story.pages.at(-1)?.art ?? "hearts" },
  ];
}

// The page turn: the new page slides in from the side it comes from with a
// slight tilt, the old one leaves the other way, both in the same grid cell so
// they overlap instead of waiting for each other. Transform and opacity only,
// ease-out, 320 ms. Arrow keys turn instantly (a keyboard action never
// animates); reduced motion keeps only the fade (MotionConfig in providers).
const turn = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 56, rotateY: dir * -10 }),
  center: { opacity: 1, x: 0, rotateY: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -56, rotateY: dir * 10 }),
};

export function StoryReader({
  memberId,
  story,
  isAuthor,
  partnerName,
}: {
  memberId: string;
  story: Story;
  isAuthor: boolean;
  partnerName?: string;
}) {
  const router = useRouter();
  const all = leaves(story);
  const [[index, dir], setPage] = useState<[number, number]>([0, 1]);
  const [instant, setInstant] = useState(false);
  const [visibility, setVisibility] = useState(story.visibility);
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (next: number, fromKeyboard = false) => {
      if (next < 0 || next >= all.length) return;
      setInstant(fromKeyboard);
      setPage(([cur]) => [next, next > cur ? 1 : -1]);
    },
    [all.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") go(index + 1, true);
      if (e.key === "ArrowLeft") go(index - 1, true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Swipe on touch: a short horizontal fling turns the page.
  const startX = useRef<number | null>(null);
  const leaf = all[index];

  function share(next: "private" | "partner") {
    const before = visibility;
    setVisibility(next);
    startTransition(async () => {
      const { error } = await api.PATCH("/members/{memberId}/stories/{storyId}", {
        params: { path: { memberId, storyId: story.id } },
        body: { visibility: next },
      });
      if (error) {
        setVisibility(before);
        toast.error("Could not change who sees it. Please try again.");
        return;
      }
      toast.success(next === "partner" ? `Shared with ${partnerName ?? "your partner"}` : "Only you can see it now");
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete “${story.title}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const { error } = await api.DELETE("/members/{memberId}/stories/{storyId}", { params: { path: { memberId, storyId: story.id } } });
      if (error) {
        toast.error("Could not delete it. Please try again.");
        return;
      }
      toast.success("Story deleted");
      router.push(`/family/${memberId}/baby/storybook`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-roledescription="picture book"
        aria-label={story.title}
        className="pp-story-book relative [perspective:1600px]"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="grid">
          <AnimatePresence initial={false} custom={dir}>
            <motion.article
              key={index}
              custom={dir}
              variants={turn}
              initial="enter"
              animate="center"
              exit="exit"
              transition={instant ? { duration: 0 } : { duration: 0.32, ease: ease.out }}
              className="col-start-1 row-start-1 grid overflow-hidden rounded-[1.75rem] bg-card shadow-[0_1px_0_var(--line),0_18px_40px_-24px_rgb(43_38_32/0.35)] [transform-origin:50%_50%] md:rounded-[2.25rem] @4xl:grid-cols-2"
              aria-label={leaf.kind === "page" ? `Page ${index} of ${story.pages.length}` : leaf.kind === "cover" ? "Cover" : "The end"}
            >
              <StoryArt art={leaf.art} ageMonths={story.ageMonths} seed={`${story.id}-${index}`} label={story.childName} interactive />
              <div className="flex min-h-56 flex-col justify-center gap-4 p-7 md:p-12">
                {leaf.kind === "cover" ? (
                  <>
                    <p className="font-mono text-caption tracking-wide text-muted-foreground uppercase">A story for {story.childName}</p>
                    <h2 className="text-display text-balance">{story.title}</h2>
                    <p className="text-body text-ink-2">Told by {story.signedAs}</p>
                  </>
                ) : leaf.kind === "end" ? (
                  <>
                    <h2 className="text-display">The end</h2>
                    <p className="text-body text-ink-2">Read it again tomorrow, or print it for the shelf.</p>
                  </>
                ) : (
                  <p className="text-headline text-pretty">{leaf.text}</p>
                )}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </section>

      <nav aria-label="Pages" className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="press flex h-12 items-center gap-1 rounded-full border border-line bg-card px-5 text-label disabled:opacity-40"
        >
          <ChevronLeft aria-hidden className="size-4.5" /> Back
        </button>
        <p className="font-mono text-caption text-muted-foreground sm:hidden">
          {index + 1} / {all.length}
        </p>
        <ol className="hidden items-center justify-center gap-1.5 sm:flex" aria-label={`Page ${index + 1} of ${all.length}`}>
          {all.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={i === 0 ? "Cover" : i === all.length - 1 ? "The end" : `Page ${i}`}
                aria-current={i === index ? "page" : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block size-2 rounded-full bg-line-2 transition-transform duration-200 [transition-timing-function:var(--ease-out)]",
                    i === index && "scale-150 bg-me",
                  )}
                />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === all.length - 1}
          className="press flex h-12 items-center gap-1 rounded-full bg-me px-5 text-label text-white disabled:opacity-40"
        >
          {index === 0 ? "Open" : "Next"} <ChevronRight aria-hidden className="size-4.5" />
        </button>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => window.print()} className="press flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-label">
          <Printer aria-hidden className="size-4" /> Print the book
        </button>
        {isAuthor ? (
          <>
            <button
              type="button"
              disabled={pending}
              aria-pressed={visibility === "partner"}
              onClick={() => share(visibility === "partner" ? "private" : "partner")}
              className={cn(
                "press flex h-11 items-center gap-2 rounded-full px-4 text-label transition-colors duration-200",
                visibility === "partner" ? "bg-them-soft text-them" : "border border-line bg-card",
              )}
            >
              {visibility === "partner" ? <Users aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
              {visibility === "partner" ? `Shared with ${partnerName ?? "your partner"}` : `Only you. Share with ${partnerName ?? "your partner"}`}
            </button>
            <button type="button" disabled={pending} onClick={remove} className="press flex h-11 items-center gap-2 rounded-full px-3 text-label text-muted-foreground">
              <Trash2 aria-hidden className="size-4" /> Delete
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2 text-label text-muted-foreground">
            <Users aria-hidden className="size-4" /> {story.signedAs} shared this with you
          </span>
        )}
      </div>

      {/* Every page at once, only for print (storybook.css): one page per sheet. */}
      <div className="pp-story-print" aria-hidden="true">
        {all.map((l, i) => (
          <div key={i} className="pp-story-print-page">
            <StoryArt art={l.art} ageMonths={story.ageMonths} seed={`${story.id}-print-${i}`} />
            {l.kind === "cover" ? (
              <div>
                <p className="pp-story-print-eyebrow">A story for {story.childName}</p>
                <h2 className="pp-story-print-title">{story.title}</h2>
                <p>Told by {story.signedAs}</p>
              </div>
            ) : (
              <p className={l.kind === "end" ? "pp-story-print-title" : "pp-story-print-text"}>{l.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
