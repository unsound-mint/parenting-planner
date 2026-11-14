"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Check, ChevronDown, LifeBuoy, Lock, MessageCircleHeart } from "lucide-react";
import type { LearningPath, Lesson, Parent } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { SourceLine } from "@/components/joy/source-line";
import { ease, spring } from "@/components/joy/motion";
import { useFamilyNow } from "@/components/shell/family-clock";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Burst } from "./celebrate";
import { agoWords, lessonState, onlyFor, readOf, type Couple, type LessonState } from "./model";

export type Talked = Record<string, { talkedAt: string; talkedBy: string }>;

type Props = {
  path: LearningPath;
  couple: Couple;
  openId?: string;
  /** Lesson ids finished in this visit, for the one-time celebration. */
  justFinished: Set<string>;
  talked: Talked;
  helpHref: string;
  onToggle: (lesson: Lesson) => void;
  onMark: (lesson: Lesson, finished: boolean) => void;
  onTalked: (promptId: string) => void;
  /** Rows rise in one after another; on for a path the parent just switched to (the page entrance covers the first). */
  stagger?: boolean;
};

/** The lessons of the open path in reading order: done, reading, this week, open, later. A row opens into the lesson in place. */
export function LessonList({ path, couple, openId, ...rest }: Props) {
  return (
    <ol className="flex flex-col gap-2.5">
      {path.lessons.map((l, i) => (
        <LessonItem key={l.id} lesson={l} n={i + 1} state={lessonState(l, path, couple.me)} couple={couple} open={openId === l.id} {...rest} />
      ))}
    </ol>
  );
}

function LessonItem({
  lesson,
  n,
  state,
  couple,
  open,
  justFinished,
  talked,
  helpHref,
  onToggle,
  onMark,
  onTalked,
  stagger,
}: Omit<Props, "path" | "openId"> & { lesson: Lesson; n: number; state: LessonState; open: boolean }) {
  const now = useFamilyNow();
  const { me, them } = couple;
  const theirs = readOf(lesson, them?.id);
  const writtenFor = onlyFor(lesson);
  const later = state === "later";
  const highlight = state === "reading" || state === "next";

  const sub: string[] = [`${lesson.minutes} min`];
  if (later) sub.push(lesson.unlocksAtWeek ? `Opens in week ${lesson.unlocksAtWeek}` : "Opens later");
  else if (writtenFor && writtenFor !== me.role) sub.push(`Written for ${writtenFor === "partner" ? "partners" : "mothers"}`);
  if (!later && state !== "done" && them && theirs?.finishedAt) sub.push(`${them.displayName} read it ${agoWords(theirs.finishedAt, now)}`);
  else if (state === "reading") sub.push("You started it");
  else if (state === "next" && lesson.timing === "now") sub.push("Best read this week");

  const header = (
    <>
      <StateMark state={state} n={n} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-title", later && "text-ink-2")}>{lesson.title}</span>
        <span className="mt-0.5 block text-label font-normal text-muted-foreground">{sub.join(" · ")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {!open && state === "reading" && <span className="hidden rounded-full bg-me px-4 py-2 text-label font-semibold text-white sm:inline">Continue</span>}
        {!open && state === "next" && <span className="hidden rounded-full border border-line-2 px-4 py-2 text-label text-ink-2 sm:inline">Read</span>}
        <Who person={me} lesson={lesson} />
        {them && <Who person={them} lesson={lesson} />}
        {!later && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-(--duration-base) ease-(--ease-out)", open && "rotate-180")} aria-hidden />}
      </span>
    </>
  );

  return (
    <motion.li
      id={`lesson-${lesson.id}`}
      layout="position"
      initial={stagger ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ layout: spring.ui, default: { duration: 0.32, ease: ease.out, delay: stagger ? (n - 1) * 0.04 : 0 } }}
      className={cn(
        "relative min-w-0 rounded-3xl border bg-card transition-[border-color,box-shadow] duration-(--duration-base)",
        later ? "border-dashed border-line-2 bg-transparent" : highlight ? "border-me-mid shadow-[0_10px_26px_rgb(160_72_40/0.08)]" : "border-line",
        open && "border-me-mid",
      )}
    >
      {later ? (
        <div className="flex items-center gap-4 px-4 py-4 md:px-5">{header}</div>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(lesson)}
          aria-expanded={open}
          className="press flex w-full items-center gap-4 rounded-3xl px-4 py-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-5"
        >
          {header}
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="reader"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: spring.ui, opacity: { duration: 0.2, ease: ease.out } }}
            className="overflow-hidden"
          >
            <Reader lesson={lesson} couple={couple} finished={state === "done"} celebrate={justFinished.has(lesson.id)} talked={talked} helpHref={helpHref} onMark={onMark} onTalked={onTalked} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function StateMark({ state, n }: { state: LessonState; n: number }) {
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-full font-heading text-body font-semibold transition-colors duration-(--duration-slow)",
        state === "done" ? "bg-leaf-soft text-leaf" : state === "reading" || state === "next" ? "bg-me text-white" : "bg-muted text-ink-2",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {state === "done" ? (
          <motion.span key="done" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={spring.playful}>
            <Check className="size-4.5" strokeWidth={2.6} aria-label="Read" />
          </motion.span>
        ) : state === "later" ? (
          <Lock className="size-4 text-muted-foreground" aria-label="Not open yet" />
        ) : (
          <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {n}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A parent's avatar on a lesson: solid when they finished it, soft when they started, absent otherwise. */
function Who({ person, lesson }: { person: Parent; lesson: Lesson }) {
  const read = readOf(lesson, person.id);
  if (!read) return null;
  if (read.finishedAt) return <Avatar person={person} size="sm" />;
  const accent = roleAccent[person.role];
  return (
    <span title={`${person.displayName} started it`} className={cn("inline-flex size-5.5 items-center justify-center rounded-full text-[0.6875rem] font-semibold", accent.soft, accent.text)}>
      {person.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

function Reader({
  lesson,
  couple,
  finished,
  celebrate,
  talked,
  helpHref,
  onMark,
  onTalked,
}: {
  lesson: Lesson;
  couple: Couple;
  finished: boolean;
  celebrate: boolean;
  talked: Talked;
  helpHref: string;
  onMark: (lesson: Lesson, finished: boolean) => void;
  onTalked: (promptId: string) => void;
}) {
  const now = useFamilyNow();
  const promptId = `lesson:${lesson.id}`;
  const talk = talked[promptId];
  const talker = talk && [couple.me, couple.them].find((p) => p?.id === talk.talkedBy);
  return (
    <div className="flex flex-col gap-5 px-4 pb-5 md:px-5 md:pl-19">
      <div className="flex max-w-prose flex-col gap-3 text-body text-ink-2">
        {lesson.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {lesson.urgentHelpLink && (
        // The fixed Urgent help screen, never animated (docs/design.md, Motion rule 8).
        <Link href={helpHref} className="flex max-w-prose items-center gap-3 rounded-2xl border border-urgent/30 bg-card px-4 py-3 text-label text-urgent outline-none focus-visible:ring-3 focus-visible:ring-urgent/40">
          <LifeBuoy className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">If one of these is happening now, open Urgent help</span>
            <span className="block font-normal text-ink-2">Who to call, day or night. The same screen as the red button at the top.</span>
          </span>
        </Link>
      )}

      <SourceLine sources={[lesson.source, ...lesson.extraSources]} />

      {lesson.talkPrompt && (
        <div className="max-w-prose rounded-2xl bg-them-soft px-4 py-4 md:px-5">
          <p className="flex items-center gap-2 text-caption font-semibold tracking-[0.08em] text-them uppercase">
            <MessageCircleHeart className="size-4" aria-hidden />
            Talk about it together
          </p>
          <p className="mt-2 text-title">{lesson.talkPrompt}</p>
          <div className="mt-3 min-h-11">
            <AnimatePresence initial={false} mode="popLayout">
              {talk ? (
                <motion.p key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.ui} className="flex min-h-11 items-center gap-2 text-label text-them">
                  <Check className="size-4" aria-hidden />
                  {talker && talker.id !== couple.me.id ? `${talker.displayName} marked it talked about ${agoWords(talk.talkedAt, now)}` : `You talked about it ${agoWords(talk.talkedAt, now)}`}
                </motion.p>
              ) : (
                <motion.button
                  key="ask"
                  type="button"
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onTalked(promptId)}
                  className="press min-h-11 rounded-full bg-them px-4.5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  We talked about it
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="flex min-h-11 items-center gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {finished ? (
            <motion.span key="read" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.playful} className="relative inline-flex min-h-11 items-center gap-2 rounded-full bg-leaf-soft px-4.5 text-label font-semibold text-leaf">
              {celebrate && <Burst colors={["bg-butter", roleAccent[couple.me.role].bg, "bg-leaf", couple.them ? roleAccent[couple.them.role].bg : "bg-sun-2"]} />}
              <Check className="size-4" strokeWidth={2.6} aria-hidden />
              Read
            </motion.span>
          ) : (
            <motion.button
              key="mark"
              layout
              type="button"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              onClick={() => onMark(lesson, true)}
              className="press min-h-11 rounded-full bg-me px-5 text-label font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Mark as read
            </motion.button>
          )}
        </AnimatePresence>
        {finished && (
          <button type="button" onClick={() => onMark(lesson, false)} className="min-h-11 px-2 text-label font-normal text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink">
            Mark as unread
          </button>
        )}
      </div>
    </div>
  );
}
