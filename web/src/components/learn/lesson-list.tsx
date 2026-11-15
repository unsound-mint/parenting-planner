"use client";

import { AnimatePresence, motion } from "motion/react";
import { ReadCover } from "@/components/week/read-cover";
import "@/components/week/week.css";
import Link from "next/link";
import { Check, LifeBuoy, Lock, MessageCircleHeart } from "lucide-react";
import type { LearningPath, Lesson, Parent } from "@/lib/api/types";
import { Avatar } from "@/components/joy/partner-chip";
import { ease, spring } from "@/components/joy/motion";
import { useFamilyNow } from "@/components/shell/family-clock";
import { roleAccent } from "@/lib/visuals";
import { cn } from "@/lib/utils";
import { Burst } from "./celebrate";
import { agoWords, lessonState, onlyFor, readOf, type Couple, type LessonState } from "./model";

export type Talked = Record<string, { talkedAt: string; talkedBy: string }>;

type GridProps = {
  path: LearningPath;
  couple: Couple;
  /** The lesson open in the reading sheet, so its card shows it. */
  openId?: string;
  onOpen: (lesson: Lesson) => void;
  /** Cards rise in one after another; on for a path the parent just switched to (the page entrance covers the first). */
  stagger?: boolean;
};

/** The lessons of the open path as article cards in reading order. A card opens the lesson in the reading sheet. */
export function LessonGrid({ path, couple, openId, onOpen, stagger }: GridProps) {
  // Two across, three on wide screens only when that fills every row (most paths have four lessons).
  const three = path.lessons.length % 3 === 0 && "@[100rem]:grid-cols-3";
  return (
    <ol className={cn("grid gap-3 @2xl:grid-cols-2 @2xl:gap-4", three)}>
      {path.lessons.map((l, i) => (
        <LessonTile
          key={l.id}
          lesson={l}
          n={i + 1}
          index={path.lessons.slice(0, i).filter((x) => x.pathId === l.pathId).length}
          state={lessonState(l, path, couple.me)}
          couple={couple}
          open={openId === l.id}
          onOpen={onOpen}
          stagger={stagger}
        />
      ))}
    </ol>
  );
}

const chips: Record<LessonState, { text: string; tone: string }> = {
  done: { text: "Read", tone: "bg-leaf-soft text-leaf" },
  reading: { text: "Started", tone: "bg-me-soft text-me" },
  next: { text: "Read next", tone: "bg-me text-white" },
  open: { text: "New", tone: "bg-card text-ink-2" },
  later: { text: "Later", tone: "bg-card/80 text-muted-foreground" },
};

function LessonTile({ lesson, n, index, state, couple, open, onOpen, stagger }: { lesson: Lesson; n: number; index: number; state: LessonState; couple: Couple; open: boolean; onOpen: (l: Lesson) => void; stagger?: boolean }) {
  const now = useFamilyNow();
  const { me, them } = couple;
  const theirs = readOf(lesson, them?.id);
  const writtenFor = onlyFor(lesson);
  const later = state === "later";
  const chip = later ? { ...chips.later, text: lesson.unlocksAtWeek ? `Opens in week ${lesson.unlocksAtWeek}` : "Opens later" } : chips[state];

  const meta: string[] = [];
  if (!later && writtenFor && writtenFor !== me.role) meta.push(`For ${writtenFor === "partner" ? "partners" : "mothers"}`);
  if (!later && them && theirs?.finishedAt) meta.push(`${them.displayName} read it ${agoWords(theirs.finishedAt, now)}`);
  else if (!later && them && theirs) meta.push(`${them.displayName} is reading it`);
  else if (state === "next" && lesson.timing === "now") meta.push("Best read this week");

  const body = (
    <>
      <span className={cn("relative block w-28 shrink-0 self-stretch overflow-hidden @2xl:h-28 @2xl:w-auto @7xl:h-30", later && "opacity-55 grayscale-[.4]")}>
        <ReadCover pathId={lesson.pathId} lessonId={lesson.id} index={index} />
        <span className={cn("absolute top-2.5 left-2.5 hidden items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.06)] @2xl:inline-flex", chip.tone)}>
          {state === "done" && <Check className="size-3.5" strokeWidth={2.6} aria-hidden />}
          {later && <Lock className="size-3" aria-hidden />}
          {chip.text}
        </span>
        {!later && <span className="pp-wk-curl" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3.5 @2xl:px-4.5 @2xl:pt-3.5 @2xl:pb-4">
        <span className="flex items-center gap-2 font-mono text-caption text-muted-foreground">
          <span>
            {n} · {lesson.minutes} min
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px font-sans font-semibold @2xl:hidden", chip.tone, state === "open" && "bg-muted")}>
            {state === "done" && <Check className="size-3" strokeWidth={2.6} aria-hidden />}
            {chip.text}
          </span>
        </span>
        <span className={cn("text-title text-pretty", later && "text-ink-2")}>{lesson.title}</span>
        <span className="mt-auto flex min-h-6 items-center gap-2 pt-1">
          <span className="flex items-center -space-x-1">
            <Who person={me} lesson={lesson} />
            {them && <Who person={them} lesson={lesson} />}
          </span>
          {meta.length > 0 && <span className="min-w-0 truncate text-label font-normal text-muted-foreground">{meta.join(" · ")}</span>}
        </span>
      </span>
    </>
  );

  const shell = cn(
    "flex h-full w-full min-w-0 overflow-hidden rounded-3xl border text-left @2xl:flex-col",
    later ? "border-dashed border-line-2 bg-transparent" : "border-line bg-card",
    !later && (state === "next" || state === "reading") && "border-me-mid shadow-[0_10px_26px_rgb(160_72_40/0.08)]",
    open && "border-me ring-2 ring-me/30",
  );

  return (
    <motion.li
      id={`lesson-${lesson.id}`}
      initial={stagger ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: ease.out, delay: stagger ? (n - 1) * 0.04 : 0 }}
      className="flex min-w-0"
    >
      {later ? (
        <div className={shell} aria-label={`${lesson.title}, not open yet`}>
          {body}
        </div>
      ) : (
        <button type="button" onClick={() => onOpen(lesson)} aria-haspopup="dialog" className={cn(shell, "pp-wk-read lift press group outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}>
          {body}
        </button>
      )}
    </motion.li>
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

export function Reader({
  lesson,
  couple,
  finished,
  celebrate,
  bothDone,
  talked,
  helpHref,
  onMark,
  onTalked,
}: {
  lesson: Lesson;
  couple: Couple;
  finished: boolean;
  celebrate: boolean;
  /** The path's title when this finish completed it for both parents. */
  bothDone?: string;
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
    <div className="flex flex-col gap-5">
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

      <div className="flex min-h-11 flex-wrap items-center gap-3">
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
        {finished && bothDone && couple.them && (
          <motion.span initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.playful, delay: 0.25 }} className="text-label text-ink-2">
            You and {couple.them.displayName} both finished “{bothDone}”.
          </motion.span>
        )}
        {finished && !bothDone && (
          <button type="button" onClick={() => onMark(lesson, false)} className="min-h-11 px-2 text-label font-normal text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink">
            Mark as unread
          </button>
        )}
      </div>
    </div>
  );
}
