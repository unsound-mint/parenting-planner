"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { LearningPath, Lesson, QuizQuestion } from "@/lib/api/types";
import { saveCoupleTalk, saveLessonRead, saveQuizAnswer } from "@/app/family/[memberId]/learn/actions";
import { Rise } from "@/components/joy/rise";
import { ease, spring } from "@/components/joy/motion";
import { roleAccent } from "@/lib/visuals";
import { Burst } from "./celebrate";
import { ParentProgress } from "./dots";
import { LessonGrid, type Talked } from "./lesson-list";
import { LessonSheet } from "./lesson-sheet";
import { PathCover } from "./path-cover";
import { PathList } from "./path-list";
import { TalkCard } from "./talk-card";
import { bothFinished, heroPath, minutesLeft, minutesWord, nextLesson, progressOf, putRead, readOf, withLesson, withQuizResult, type Couple } from "./model";

const scrollBehavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

type Props = {
  memberId: string;
  couple: Couple;
  initialPaths: LearningPath[];
  /** From ?path= and ?lesson=, so a link can open a path or a lesson. */
  initialPathId?: string;
  initialLessonId?: string;
  talked: Talked;
  helpHref: string;
};

/**
 * Learn's interactive part: the path list, the open path (cover, both
 * parents' dots, lesson cards that open a reading sheet) and the rail with the quiz and a
 * talk prompt. Reads, answers and talks are saved through server actions and
 * applied here at once, so the dots fill while the request runs.
 */
export function LearnBoard({ memberId, couple, initialPaths, initialPathId, initialLessonId, talked: initialTalked, helpHref }: Props) {
  const { me, them } = couple;
  const [paths, setPaths] = useState(initialPaths);
  const lessonPath = initialLessonId ? initialPaths.find((p) => p.lessons.some((l) => l.id === initialLessonId)) : undefined;
  const [pathId, setPathId] = useState(() => lessonPath?.id ?? initialPaths.find((p) => p.id === initialPathId)?.id ?? heroPath(initialPaths, me)?.id ?? "");
  const [openId, setOpenId] = useState<string | undefined>(lessonPath ? initialLessonId : undefined);
  const [talked, setTalked] = useState(initialTalked);
  const [justFinished, setJustFinished] = useState<Set<string>>(new Set());
  const [pathParty, setPathParty] = useState<string | null>(null);
  const [switched, setSwitched] = useState(false);
  // Query inside this board only: Next keeps the previous parent's page mounted
  // but hidden (Activity), so a document-wide id lookup can find its copy.
  const root = useRef<HTMLDivElement>(null);
  const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector);

  const path = paths.find((p) => p.id === pathId) ?? paths[0];
  if (!path) return null;

  // The URL follows what is open, so a reload or a shared link lands on it. No navigation, no refetch.
  function syncUrl(nextPath: string, lesson?: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("path", nextPath);
    if (lesson) url.searchParams.set("lesson", lesson);
    else url.searchParams.delete("lesson");
    window.history.replaceState(window.history.state, "", url);
  }

  function pickPath(p: LearningPath) {
    if (p.id === pathId) return;
    setPathId(p.id);
    setOpenId(undefined);
    setSwitched(true);
    syncUrl(p.id);
    // Bring the new hero into view when the list was scrolled past it (long pages, phones).
    requestAnimationFrame(() => {
      const hero = find("#path-hero");
      if (hero && hero.getBoundingClientRect().top < 0) hero.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  }

  function open(lesson: Lesson) {
    setOpenId(lesson.id);
    syncUrl(lesson.pathId, lesson.id);
    // Opening a lesson starts it, once. Never send finished:false for a lesson
    // already finished: the API reads that as "undo".
    if (!readOf(lesson, me.id)) {
      setPaths((ps) => withLesson(ps, lesson.id, (l) => putRead(l, { memberId: me.id, lessonId: l.id, startedAt: new Date().toISOString() })));
      void saveLessonRead(memberId, lesson.id, false);
    }
  }

  function close() {
    setOpenId(undefined);
    syncUrl(path.id);
  }

  async function mark(lesson: Lesson, finished: boolean) {
    const before = paths;
    const prev = readOf(lesson, me.id);
    const startedAt = prev?.startedAt ?? new Date().toISOString();
    const next = withLesson(paths, lesson.id, (l) => putRead(l, { memberId: me.id, lessonId: l.id, startedAt, ...(finished ? { finishedAt: new Date().toISOString() } : {}) }));
    setPaths(next);
    if (finished) {
      setJustFinished((s) => new Set(s).add(lesson.id));
      const p = next.find((x) => x.id === lesson.pathId);
      if (p && bothFinished(p, couple)) setPathParty(p.id);
    } else {
      setPathParty(null);
    }
    const res = await saveLessonRead(memberId, lesson.id, finished);
    if (!res.ok) {
      setPaths(before);
      toast.error("Could not save that. Please try again.");
    }
  }

  async function answer(q: QuizQuestion, choiceId: string): Promise<boolean> {
    const res = await saveQuizAnswer(memberId, q.id, choiceId);
    if (!res.ok) {
      toast.error("Could not save your answer. Please try again.");
      return false;
    }
    setPaths((ps) => withQuizResult(ps, q, me.id, choiceId, res.data));
    return true;
  }

  async function talk(promptId: string) {
    const optimistic = { talkedBy: me.id, talkedAt: new Date().toISOString() };
    setTalked((t) => ({ ...t, [promptId]: t[promptId] ?? optimistic }));
    const res = await saveCoupleTalk(memberId, promptId);
    if (res.ok) setTalked((t) => ({ ...t, [promptId]: { talkedBy: res.data.talkedBy, talkedAt: res.data.talkedAt } }));
    else {
      setTalked((t) => {
        const rest = { ...t };
        delete rest[promptId];
        return rest;
      });
      toast.error("Could not save that. Please try again.");
    }
  }

  // The rail's quiz: the lesson to read next, else the first open lesson with a question left.
  const opened = path.lessons.find((l) => l.id === openId);
  // When every open question is answered, the first answered one stays, so the comparison with the partner is still there.

  const mine = progressOf(path, me.id);
  const theirs = progressOf(path, them?.id);
  const left = minutesLeft(path, me.id);
  const started = mine.finished + mine.started > 0;
  const first = nextLesson(path, me);
  const quizCount = path.lessons.reduce((n, l) => n + l.quiz.length, 0);
  const party = pathParty === path.id;

  return (
    <div ref={root} className="grid min-w-0 items-start gap-6 @4xl:grid-cols-[17rem_minmax(0,1fr)] @7xl:grid-cols-[20rem_minmax(0,1fr)_24rem] @[100rem]:grid-cols-[20.5rem_minmax(0,1fr)_26rem]">
      <Rise i={1} className="min-w-0 @4xl:sticky @4xl:top-4">
        <PathList paths={paths} couple={couple} currentId={path.id} onPick={pickPath} />
      </Rise>

      <Rise i={2} className="flex min-w-0 flex-col gap-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.section
            key={path.id}
            id="path-hero"
            aria-labelledby="path-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: ease.out }}
            className="relative mb-3.5 scroll-mt-4 overflow-hidden rounded-[1.75rem] bg-sun md:rounded-[2rem]"
          >
            <PathCover pathId={path.id} />
            <div className="flex flex-col gap-3 px-5.5 pt-2 pb-6 md:px-8 md:pb-7">
              <p className="text-caption font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Path · {path.lessons.length} short reads{quizCount > 0 ? ` · ${quizCount} quiz questions` : ""}
              </p>
              <h2 id="path-title" className="text-display">
                {path.title}
              </h2>
              <p className="max-w-prose text-body text-ink-2">{path.why}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-7 gap-y-2.5">
                <ParentProgress person={me} progress={mine} isMe />
                {them && <ParentProgress person={them} progress={theirs} isMe={false} />}
                <span className="relative text-label font-normal text-muted-foreground">
                  {party && <Burst key="party" radius={48} colors={["bg-butter", roleAccent[me.role].bg, them ? roleAccent[them.role].bg : "bg-leaf", "bg-leaf"]} />}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={party ? "party" : `${left}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={party ? spring.playful : { duration: 0.18 }} className="inline-block">
                      {party
                        ? `You both finished ${path.title}.`
                        : bothFinished(path, couple)
                          ? "You both read every lesson here."
                          : left === 0
                            ? "You read everything open so far."
                            : started
                              ? `${minutesWord(left)} left for you`
                              : first
                                ? `Start with ${minutesWord(first.minutes)}: “${first.title}”`
                                : null}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </div>
          </motion.section>
        </AnimatePresence>

        <LessonGrid key={path.id} path={path} couple={couple} openId={openId} onOpen={open} stagger={switched} />
        <LessonSheet
          path={path}
          lesson={opened}
          couple={couple}
          justFinished={justFinished}
          pathParty={party ? path.title : undefined}
          talked={talked}
          helpHref={helpHref}
          onClose={close}
          onOpen={open}
          onMark={mark}
          onTalked={talk}
          onAnswer={answer}
        />
      </Rise>

      <Rise i={3} className="flex min-w-0 flex-col gap-6 @4xl:col-start-2 @4xl:grid @4xl:grid-cols-2 @4xl:items-start @7xl:sticky @7xl:top-4 @7xl:col-start-3 @7xl:row-start-1 @7xl:flex @7xl:items-stretch">
        <TalkCard key={path.id} lessons={path.lessons.filter((l) => l.id !== openId)} couple={couple} talked={talked} onTalked={talk} />
      </Rise>
    </div>
  );
}
