import type { LearningPath, Lesson, LessonRead, Parent, QuizQuestion, QuizResult } from "@/lib/api/types";
import { daysUntilInstant } from "@/lib/format";

// Pure helpers for Learn: which path opens first, what state each lesson is in
// for the acting parent, and how far each parent is. Everything comes from the
// API's reads; nothing here is invented for the screen.

export type Couple = { me: Parent; them?: Parent };

export type LessonState =
  /** The acting parent finished it. */
  | "done"
  /** The acting parent started it and has not finished. */
  | "reading"
  /** The one to read next in this path: open, best read now, not finished. */
  | "next"
  /** Not started. Any lesson can be read ahead; the week is only a hint. */
  | "open";

export const readOf = (lesson: Lesson, memberId: string | undefined): LessonRead | undefined =>
  memberId ? lesson.reads.find((r) => r.memberId === memberId) : undefined;

export const finishedBy = (lesson: Lesson, memberId: string | undefined) => !!readOf(lesson, memberId)?.finishedAt;

/** Written for one parent only, e.g. partner-only lessons. Both parents can still read them. */
export const onlyFor = (lesson: Lesson): "mother" | "partner" | undefined =>
  lesson.audience.length === 1 ? (lesson.audience[0] as "mother" | "partner") : undefined;

/** The lesson the acting parent should read next in a path, or undefined when nothing is left open. */
export function nextLesson(path: LearningPath, me: Parent): Lesson | undefined {
  const open = path.lessons.filter((l) => !finishedBy(l, me.id));
  const forMe = (l: Lesson) => !onlyFor(l) || onlyFor(l) === me.role;
  return (
    open.find((l) => readOf(l, me.id)) ??
    open.find((l) => l.timing === "now" && forMe(l)) ??
    open.find((l) => l.timing !== "past" && forMe(l)) ??
    open.find(forMe) ??
    open[0]
  );
}

export function lessonState(lesson: Lesson, path: LearningPath, me: Parent): LessonState {
  const read = readOf(lesson, me.id);
  if (read?.finishedAt) return "done";
  if (read) return "reading";
  return nextLesson(path, me)?.id === lesson.id ? "next" : "open";
}

/** Path to open first: where the acting parent is mid-read, then the one with the most open "now" reads, then the first. */
export function heroPath(paths: LearningPath[], me: Parent): LearningPath | undefined {
  const midRead = paths.find((p) => p.lessons.some((l) => l.timing === "now" && readOf(l, me.id) && !finishedBy(l, me.id)));
  if (midRead) return midRead;
  const openNow = (p: LearningPath) => p.lessons.filter((l) => l.timing === "now" && !finishedBy(l, me.id)).length;
  const best = [...paths].sort((a, b) => openNow(b) - openNow(a))[0];
  return best && openNow(best) > 0 ? best : paths.find((p) => nextLesson(p, me)) ?? paths[0];
}

export type Progress = { finished: number; started: number; total: number };

/** One parent's progress in a path, counted from the lesson reads (so it updates with a local change). */
export function progressOf(path: LearningPath, memberId: string | undefined): Progress {
  let finished = 0;
  let started = 0;
  for (const l of path.lessons) {
    const r = readOf(l, memberId);
    if (r?.finishedAt) finished++;
    else if (r) started++;
  }
  return { finished, started, total: path.lessons.length };
}

/** Reading minutes the acting parent has left in the open lessons of a path. */
export function minutesLeft(path: LearningPath, memberId: string): number {
  return path.lessons.filter((l) => !finishedBy(l, memberId)).reduce((sum, l) => sum + l.minutes, 0);
}

export const bothFinished = (path: LearningPath, couple: Couple) =>
  !!couple.them && path.lessons.length > 0 && path.lessons.every((l) => finishedBy(l, couple.me.id) && finishedBy(l, couple.them?.id));

/** "1 minute", "3 minutes". */
export const minutesWord = (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`;

/** Replace a lesson inside the path list, returning new arrays so React sees the change. */
export function withLesson(paths: LearningPath[], lessonId: string, change: (l: Lesson) => Lesson): LearningPath[] {
  return paths.map((p) => (p.lessons.some((l) => l.id === lessonId) ? { ...p, lessons: p.lessons.map((l) => (l.id === lessonId ? change(l) : l)) } : p));
}

/** Store the acting parent's quiz answer and what the API revealed with it (right choice, why, the partner's pick). */
export function withQuizResult(paths: LearningPath[], q: QuizQuestion, memberId: string, choiceId: string, r: QuizResult): LearningPath[] {
  return withLesson(paths, q.lessonId, (l) => ({
    ...l,
    quiz: l.quiz.map((x) =>
      x.id !== q.id
        ? x
        : {
            ...x,
            correctChoiceId: r.correctChoiceId,
            explanation: r.explanation,
            answers: [
              { memberId, choiceId, correct: r.correct, answeredAt: new Date().toISOString() },
              ...(r.partnerAnswer ? [r.partnerAnswer] : x.answers.filter((a) => a.memberId !== memberId)),
            ],
          },
    ),
  }));
}

/** Store a read on a lesson: the acting parent's read replaces theirs, the other parent's stays. */
export const putRead = (l: Lesson, read: LessonRead): Lesson => ({ ...l, reads: [read, ...l.reads.filter((r) => r.memberId !== read.memberId)] });

const longWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

/** "today", "yesterday", "on Tuesday" within a week, "on Nov 3" before that. Eastern time, like lib/format. */
export function agoWords(iso: string, now: Date): string {
  const days = -daysUntilInstant(iso, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `on ${longWeekday.format(new Date(iso))}`;
  return `on ${monthDay.format(new Date(iso))}`;
}
