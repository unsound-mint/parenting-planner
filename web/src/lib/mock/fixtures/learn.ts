import { mock, type MockContext } from "../registry";
import { at, couple, dayOf } from "../timeline";
import { dayKey } from "@/lib/format";
import { learnPaths, talkPool, type CatalogLesson } from "./learn-catalog";
import { uid } from "./dates";
import type {
  BabyName,
  Family,
  LearningPath,
  Lesson,
  LessonRead,
  LessonTiming,
  PartnerNudge,
  QuizAnswer,
  QuizQuestion,
  TalkPrompt,
} from "@/lib/api/types";

// Preview data for Learn and the "Tonight, together" card. The story is the
// real seed's (api/internal/demo, seedLearning): Emily and Jake at week 25.
// Jake finished "Pain relief: the options" yesterday and answered its quiz;
// Emily started it. Names Ada, June and Theo are liked by both. Changes made
// in the preview are kept in memory until the dev server restarts.

type Who = "mother" | "partner";
type ReadSpec = { who: Who; lesson: string; started: number; finished?: number };
type AnswerSpec = { who: Who; question: string; choice: string; day: number };
type NameSpec = { name: string; by: Who; likers: Who[]; day: number };

const reads: ReadSpec[] = [
  { who: "mother", lesson: "visit-rhythm", started: -62, finished: -62 },
  { who: "mother", lesson: "everyday-habits", started: -46, finished: -45 },
  { who: "mother", lesson: "first-movements", started: -10, finished: -10 },
  { who: "mother", lesson: "warning-signs", started: -2 },
  { who: "mother", lesson: "research-on-couples", started: -30, finished: -30 },
  { who: "mother", lesson: "whats-common", started: -20, finished: -20 },
  { who: "mother", lesson: "pain-relief", started: -1 },
  { who: "partner", lesson: "visit-rhythm", started: -50, finished: -50 },
  { who: "partner", lesson: "everyday-habits", started: -40, finished: -40 },
  { who: "partner", lesson: "first-movements", started: -6, finished: -6 },
  { who: "partner", lesson: "show-up", started: -35, finished: -35 },
  { who: "partner", lesson: "partner-mental-health", started: -4, finished: -4 },
  { who: "partner", lesson: "research-on-couples", started: -28, finished: -28 },
  { who: "partner", lesson: "fmla-basics", started: -14, finished: -14 },
  { who: "partner", lesson: "pain-relief", started: -1, finished: -1 },
];

const answers: AnswerSpec[] = [
  { who: "partner", question: "pain-relief-q1", choice: "b", day: -1 },
  { who: "partner", question: "pain-relief-q2", choice: "a", day: -1 },
  { who: "partner", question: "pain-relief-q3", choice: "a", day: -1 },
];

const names: NameSpec[] = [
  { name: "Ada", by: "mother", likers: ["mother", "partner"], day: -20 },
  { name: "June", by: "partner", likers: ["partner", "mother"], day: -12 },
  { name: "Theo", by: "mother", likers: ["mother", "partner"], day: -5 },
  { name: "Rose", by: "mother", likers: ["mother"], day: -3 },
  { name: "Miles", by: "partner", likers: ["partner"], day: -2 },
];

const talks: { prompt: string; who: Who; day: number }[] = [{ prompt: "p08", who: "partner", day: -6 }];

// Pregnancy is the only stage with seeded progress; other stages start fresh.
type Store = {
  reads: Map<string, LessonRead>; // `${memberId}:${lessonId}`
  answers: Map<string, QuizAnswer & { questionId: string }>; // `${memberId}:${questionId}`
  names: BabyName[];
  talks: Map<string, { talkedBy: string; talkedAt: string }>;
};
const stores = new Map<string, Store>();

function storeFor(family: Family): Store {
  let s = stores.get(family.id);
  if (s) return s;
  const c = couple(family);
  const id = (w: Who) => (w === "mother" ? c.mother.id : c.partner.id);
  const seeded = family.stage === "pregnancy";
  s = { reads: new Map(), answers: new Map(), names: [], talks: new Map() };
  if (seeded) {
    for (const r of reads) {
      s.reads.set(`${id(r.who)}:${r.lesson}`, {
        memberId: id(r.who),
        lessonId: r.lesson,
        startedAt: at(r.started, "20:30"),
        ...(r.finished !== undefined ? { finishedAt: at(r.finished, "20:45") } : {}),
      });
    }
    for (const a of answers) {
      s.answers.set(`${id(a.who)}:${a.question}`, { memberId: id(a.who), questionId: a.question, choiceId: a.choice, answeredAt: at(a.day, "20:50") });
    }
    s.names = names.map((n, i) => ({
      id: uid(1700 + i),
      name: n.name,
      addedBy: id(n.by),
      likedBy: n.likers.map(id),
      bothLike: n.likers.length === 2,
      createdAt: at(n.day, "21:00"),
    }));
    for (const t of talks) s.talks.set(t.prompt, { talkedBy: id(t.who), talkedAt: at(t.day, "21:30") });
  }
  stores.set(family.id, s);
  return s;
}

const allLessons = learnPaths.flatMap((p) => p.lessons.map((l) => ({ ...l, pathId: p.id })));
const lessonById = new Map(allLessons.map((l) => [l.id, l]));
const questionById = new Map(allLessons.flatMap((l) => l.quiz.map((q) => [q.id, { ...q, lesson: l }] as const)));

function timingOf(l: CatalogLesson, week: number | undefined): { timing: LessonTiming; locked: boolean; unlocksAtWeek?: number } {
  if (week === undefined) return { timing: "now", locked: false };
  const unlocksAtWeek = Math.max(4, l.weeks[0] - 4);
  const timing: LessonTiming = week < l.weeks[0] ? "upcoming" : week > l.weeks[1] ? "past" : "now";
  return { timing, locked: week < unlocksAtWeek, unlocksAtWeek };
}

async function context(ctx: MockContext<unknown>) {
  const family = await ctx.family();
  const c = couple(family);
  const me = ctx.path.memberId;
  const other = me === c.partner.id ? c.mother : c.partner;
  const week = family.stage === "pregnancy" ? family.gestationalWeek : undefined;
  return { family, me, other, week, store: storeFor(family) };
}

function questionOut(q: (typeof allLessons)[number]["quiz"][number], lessonId: string, s: Store, me: string, other: string): QuizQuestion {
  const mine = s.answers.get(`${me}:${q.id}`);
  const theirs = s.answers.get(`${other}:${q.id}`);
  const out: QuizQuestion = { id: q.id, lessonId, prompt: q.prompt, choices: q.choices, answers: [] };
  if (mine) {
    out.answers.push({ memberId: me, choiceId: mine.choiceId, correct: mine.choiceId === q.correct, answeredAt: mine.answeredAt });
    out.correctChoiceId = q.correct;
    out.explanation = q.why;
  }
  if (theirs) {
    out.answers.push(
      mine
        ? { memberId: other, choiceId: theirs.choiceId, correct: theirs.choiceId === q.correct, answeredAt: theirs.answeredAt }
        : { memberId: other, answeredAt: theirs.answeredAt },
    );
  }
  return out;
}

const relDay = (iso: string) => {
  const days = Math.round((Date.parse(dayOf(0)) - Date.parse(dayKey(iso))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `on ${new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })}`;
};

export const learnMocks = {
  ...mock("/members/{memberId}/learning-paths", "get", async (ctx) => {
    const { family, me, other, week, store } = await context(ctx);
    const items: LearningPath[] = learnPaths
      .filter((p) => p.stages.includes(family.stage))
      .map((p) => {
        const lessons: Lesson[] = p.lessons.map((l) => {
          const lessonReads = [store.reads.get(`${me}:${l.id}`), store.reads.get(`${other.id}:${l.id}`)].filter((r): r is LessonRead => !!r);
          return {
            id: l.id,
            pathId: p.id,
            title: l.title,
            body: l.body,
            minutes: l.minutes,
            ...(week !== undefined ? { weekFrom: l.weeks[0], weekTo: l.weeks[1] } : {}),
            audience: l.audience,
            ...timingOf(l, week),
            source: l.source,
            extraSources: l.extraSources,
            ...(l.talkPrompt ? { talkPrompt: l.talkPrompt } : {}),
            urgentHelpLink: l.urgentHelpLink,
            reads: lessonReads,
            quiz: l.quiz.map((q) => questionOut(q, l.id, store, me, other.id)),
          };
        });
        const progress = [me, other.id].map((memberId) => ({
          memberId,
          started: lessons.filter((l) => l.reads.some((r) => r.memberId === memberId && !r.finishedAt)).length,
          finished: lessons.filter((l) => l.reads.some((r) => r.memberId === memberId && r.finishedAt)).length,
        }));
        return { id: p.id, title: p.title, why: p.why, lessons, progress };
      });
    return { stage: family.stage, ...(week !== undefined ? { week } : {}), items };
  }),

  ...mock("/members/{memberId}/lesson-reads/{lessonId}", "put", async (ctx) => {
    const { me, store } = await context(ctx);
    const key = `${me}:${ctx.path.lessonId}`;
    const now = new Date().toISOString();
    const prev = store.reads.get(key);
    const next: LessonRead = { memberId: me, lessonId: ctx.path.lessonId, startedAt: prev?.startedAt ?? now };
    if (ctx.body.finished) next.finishedAt = prev?.finishedAt ?? now;
    store.reads.set(key, next);
    return next;
  }),

  ...mock("/members/{memberId}/quiz-answers", "post", async (ctx) => {
    const { me, other, store } = await context(ctx);
    const q = questionById.get(ctx.body.questionId);
    if (!q) throw new Error("unknown question");
    const answeredAt = new Date().toISOString();
    store.answers.set(`${me}:${q.id}`, { memberId: me, questionId: q.id, choiceId: ctx.body.choiceId, answeredAt });
    const theirs = store.answers.get(`${other.id}:${q.id}`);
    return {
      questionId: q.id,
      choiceId: ctx.body.choiceId,
      correct: ctx.body.choiceId === q.correct,
      correctChoiceId: q.correct,
      explanation: q.why,
      source: q.lesson.source,
      ...(theirs ? { partnerAnswer: { memberId: other.id, choiceId: theirs.choiceId, correct: theirs.choiceId === q.correct, answeredAt: theirs.answeredAt } } : {}),
    };
  }),

  ...mock("/members/{memberId}/together", "get", async (ctx) => {
    const { me, other, week, store } = await context(ctx);
    const weekAgo = new Date(at(-7, "00:00")).getTime();
    const theirFinish = [...store.reads.values()]
      .filter((r) => r.memberId === other.id && r.finishedAt && new Date(r.finishedAt).getTime() >= weekAgo)
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0];
    let nudge: PartnerNudge | undefined;
    if (theirFinish?.finishedAt) {
      const title = lessonById.get(theirFinish.lessonId)?.title ?? "";
      nudge = {
        id: `lesson_finished:${theirFinish.lessonId}:${theirFinish.finishedAt}`,
        memberId: other.id,
        kind: "lesson_finished",
        at: theirFinish.finishedAt,
        lessonId: theirFinish.lessonId,
        text: `${other.displayName} finished "${title}" ${relDay(theirFinish.finishedAt)}. Ask what stood out.`,
      };
    }
    // Prompts of lessons either parent finished in the last 14 days, then this
    // week's pool, then prompts of lessons open now; talked-about ones last.
    const twoWeeks = new Date(at(-14, "00:00")).getTime();
    const recent = [...store.reads.values()]
      .filter((r) => (r.memberId === me || r.memberId === other.id) && r.finishedAt && new Date(r.finishedAt).getTime() >= twoWeeks)
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
      .map((r) => lessonById.get(r.lessonId))
      .filter((l): l is (typeof allLessons)[number] => !!l?.talkPrompt);
    const pool =
      week === undefined
        ? []
        : talkPool.filter((p) => p.weeks[0] <= week && week <= p.weeks[1]).sort((a, b) => b.weeks[0] - a.weeks[0] || a.id.localeCompare(b.id));
    const now = allLessons.filter((l) => l.talkPrompt && timingOf(l, week).timing === "now");
    const seen = new Set<string>();
    const list: TalkPrompt[] = [];
    const push = (p: TalkPrompt) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      const t = store.talks.get(p.id);
      list.push(t ? { ...p, ...t } : p);
    };
    for (const l of recent) push({ id: `lesson:${l.id}`, text: l.talkPrompt!, lessonId: l.id });
    for (const p of pool) push({ id: p.id, text: p.text });
    for (const l of now) push({ id: `lesson:${l.id}`, text: l.talkPrompt!, lessonId: l.id });
    const prompts = [...list.filter((p) => !p.talkedAt), ...list.filter((p) => p.talkedAt).sort((a, b) => (b.talkedAt ?? "").localeCompare(a.talkedAt ?? ""))];
    return { ...(nudge ? { nudge } : {}), prompts, closedNudgeIds: [] };
  }),

  ...mock("/members/{memberId}/couple-talks", "post", async (ctx) => {
    const { me, store } = await context(ctx);
    const existing = store.talks.get(ctx.body.promptId);
    const t = existing ?? { talkedBy: me, talkedAt: new Date().toISOString() };
    store.talks.set(ctx.body.promptId, t);
    return { promptId: ctx.body.promptId, ...t };
  }),

  ...mock("/members/{memberId}/baby-names", "get", async (ctx) => {
    const { store } = await context(ctx);
    const items = [...store.names].sort((a, b) => Number(b.bothLike) - Number(a.bothLike) || (b.likedBy.length > 0 ? 1 : 0) - (a.likedBy.length > 0 ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
    return { items };
  }),

  ...mock("/members/{memberId}/baby-names", "post", async (ctx) => {
    const { me, store } = await context(ctx);
    const n: BabyName = { id: crypto.randomUUID(), name: ctx.body.name.trim(), addedBy: me, likedBy: [me], bothLike: false, createdAt: new Date().toISOString() };
    store.names.push(n);
    return n;
  }),

  ...mock("/members/{memberId}/baby-names/{nameId}/like", "put", async (ctx) => {
    const { me, store } = await context(ctx);
    const n = store.names.find((x) => x.id === ctx.path.nameId);
    if (!n) throw new Error("unknown name");
    if (!n.likedBy.includes(me)) n.likedBy.push(me);
    n.bothLike = n.likedBy.length >= 2;
    return n;
  }),

  ...mock("/members/{memberId}/baby-names/{nameId}/like", "delete", async (ctx) => {
    const { me, store } = await context(ctx);
    const n = store.names.find((x) => x.id === ctx.path.nameId);
    if (!n) throw new Error("unknown name");
    n.likedBy = n.likedBy.filter((m) => m !== me);
    n.bothLike = n.likedBy.length >= 2;
    return n;
  }),
};
