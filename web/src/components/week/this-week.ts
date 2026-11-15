import type { LearningPath, Lesson, Mission, PregnancyWeek, QuizQuestion, Stage, Task } from "@/lib/api/types";

// Pure choices behind This week: which reads, which quiz, what the baby says.
// Kept apart from the components so the rules are in one readable place.

export type BabySize = NonNullable<PregnancyWeek["size"]>;

/** "head to heel" for crown-heel; the measure changes at week 20, so the label follows the data. */
export function lengthLabel(size: Pick<BabySize, "lengthMeasure">): string {
  return size.lengthMeasure === "crown-heel" ? "head to heel" : size.lengthMeasure === "crown-rump" ? "head to bottom" : "length of the embryo";
}

// US units first (the audience is American), metric second and smaller.
const CM_PER_IN = 2.54;
const G_PER_OZ = 28.3495;

/** 30.0 cm -> "11.8", one decimal so an early week still reads ("0.4"). */
export function inches(cm: number): string {
  return (cm / CM_PER_IN).toFixed(1);
}

/**
 * Grams as pounds and ounces: 760 g -> [["1", "lb"], ["11", "oz"]]; 85 g -> [["3", "oz"]];
 * under an ounce one decimal, so week 12's 14 g reads 0.5 oz. 16 oz carries to the pound.
 */
export function poundsOunces(grams: number): [string, string][] {
  const oz = grams / G_PER_OZ;
  if (oz < 1) return [[oz.toFixed(1), "oz"]];
  let lb = Math.floor(oz / 16);
  let rest = Math.round(oz - lb * 16);
  if (rest === 16) {
    lb += 1;
    rest = 0;
  }
  if (lb === 0) return [[String(rest), "oz"]];
  return rest === 0 ? [[String(lb), "lb"]] : [[String(lb), "lb"], [String(rest), "oz"]];
}

type Topic = "hearing" | "movement" | "other";

/**
 * What the week's development text supports. Only a sentence that says the
 * baby can hear (or reacts to noise or voices) earns "I can hear you"; "hearing
 * is developing" (week 18) does not.
 */
export function developmentTopic(development: string | undefined): Topic {
  const d = (development ?? "").toLowerCase();
  if (/can hear|hear voices|recogni[sz]\w* voices|loud noise|talk to the bump|sing\w* to the bump/.test(d)) return "hearing";
  if (/kick|somersault|wriggl|flutter|moving|movement/.test(d)) return "movement";
  return "other";
}

/** The baby's speech bubble when tapped. No health claim beyond the week's development line. */
export function babyBubble(topic: Topic): string {
  if (topic === "hearing") return "Hello. I can hear you now.";
  if (topic === "movement") return "Hello. That wriggle was me.";
  return "Hello from in here.";
}

/** One warm, practical invitation for tonight, built on the development topic and the other parent. */
export function warmLine(topic: Topic, partnerName: string | undefined): string {
  const with2 = partnerName ? `, and ${partnerName}'s voice counts too` : "";
  if (topic === "hearing") return `Your baby can hear you now. Tonight is a good night to read aloud${with2}.`;
  if (topic === "movement")
    return partnerName ? `Put ${partnerName}'s hand on the bump tonight and wait for a wriggle together.` : "Take a quiet minute tonight and notice the wriggles.";
  return partnerName ? `Say hello tonight, both of you. It is never too early to start.` : "Say hello tonight. It is never too early to start.";
}

/** The baby's place on the arc: week 4 is the start, week 40 the end. */
export function weekFraction(week: number): number {
  return Math.min(1, Math.max(0, (week - 4) / 36));
}

// ---------- Reads ----------

export type ReadState = "started" | "partner_read" | "both_read" | "partner_started" | "new";

export type ReadPick = { lesson: Lesson; state: ReadState };

function stateOf(lesson: Lesson, me: string): ReadState {
  const mine = lesson.reads.find((r) => r.memberId === me);
  const theirs = lesson.reads.find((r) => r.memberId !== me);
  if (mine?.finishedAt && theirs?.finishedAt) return "both_read";
  if (mine && !mine.finishedAt) return "started";
  if (theirs?.finishedAt) return "partner_read";
  if (theirs) return "partner_started";
  return "new";
}

const weight: Record<ReadState, number> = { started: 4, partner_read: 3, partner_started: 2, new: 1, both_read: 0 };

/**
 * Three reads for this week: lessons the acting parent can open and has not
 * finished, the ones they started first, then the ones the other parent read,
 * then new ones in the best-read window. One path leads (the one with the best
 * pick), so the header can show both parents' progress on it.
 */
export function pickReads(paths: LearningPath[], me: string, count = 3): { path?: LearningPath; reads: ReadPick[] } {
  const open = paths.flatMap((p) =>
    p.lessons
      .filter((l) => !l.locked && !l.reads.some((r) => r.memberId === me && r.finishedAt))
      .map((l) => ({ path: p, lesson: l, state: stateOf(l, me) })),
  );
  const score = (x: (typeof open)[number]) => weight[x.state] * 10 + (x.lesson.timing === "now" ? 5 : x.lesson.timing === "upcoming" ? 2 : 0);
  open.sort((a, b) => score(b) - score(a));
  const lead = open[0]?.path;
  if (!lead) return { reads: [] };
  // The lead path's reads first, in score order, then the best of the rest.
  const ordered = [...open.filter((x) => x.path.id === lead.id), ...open.filter((x) => x.path.id !== lead.id)];
  return { path: lead, reads: ordered.slice(0, count).map(({ lesson, state }) => ({ lesson, state })) };
}

export type QuizPick = { lesson: Lesson; questions: QuizQuestion[]; partnerAnsweredAt?: string };

/**
 * The quiz line: a lesson quiz the other parent took and the acting parent has
 * not, so they can compare tonight; otherwise the first unanswered quiz of an
 * open lesson in its window.
 */
export function pickQuiz(paths: LearningPath[], me: string): QuizPick | undefined {
  const lessons = paths.flatMap((p) => p.lessons).filter((l) => !l.locked && l.quiz.length > 0);
  const unanswered = (l: Lesson) => l.quiz.some((q) => !q.answers.some((a) => a.memberId === me));
  for (const l of lessons) {
    if (!unanswered(l)) continue;
    const theirs = l.quiz.flatMap((q) => q.answers.filter((a) => a.memberId !== me));
    if (theirs.length > 0) return { lesson: l, questions: l.quiz, partnerAnsweredAt: theirs.map((a) => a.answeredAt).sort().at(-1) };
  }
  const next = lessons.find((l) => l.timing === "now" && unanswered(l)) ?? lessons.find(unanswered);
  return next ? { lesson: next, questions: next.quiz } : undefined;
}

// ---------- Journal ----------

/**
 * A number that moves by one every week: the gestational week in pregnancy,
 * otherwise whole weeks since Monday 1970-01-05 on the family's clock (the
 * same count as content.CalendarWeek in the API), so "Skip ahead a week" turns it.
 */
export function rotationWeek(now: Date, gestationalWeek?: number): number {
  if (gestationalWeek != null) return gestationalWeek;
  return Math.floor((now.getTime() - Date.UTC(1970, 0, 5)) / (7 * 24 * 3600 * 1000));
}

function pick<T>(items: readonly T[], n: number): T {
  return items[((n % items.length) + items.length) % items.length];
}

// UI copy, not health content. Each stage has a few questions so the journal
// asks something new every week.
const prompts: Record<"pregnancy" | "late" | "planning" | "baby" | "child", readonly string[]> = {
  pregnancy: [
    "How are you feeling this week?",
    "What surprised you about this week?",
    "What are you looking forward to right now?",
    "What is on your mind tonight?",
  ],
  late: [
    "How are you feeling about the birth this week?",
    "What would make the coming weeks easier?",
    "What do you want to remember about these last weeks?",
    "How are you sleeping, and what helps?",
  ],
  planning: [
    "How are you feeling about all this today?",
    "What did you two talk about this week?",
    "What are you hoping for this month?",
    "What felt good this week?",
  ],
  baby: [
    "How are you holding up today?",
    "What was the best moment this week?",
    "What is new with the baby this week?",
    "What would help you most right now?",
  ],
  child: [
    "How was today, for you?",
    "What made you laugh together this week?",
    "What was hard this week, and what helped?",
    "What did they say this week that you want to keep?",
  ],
};

function poolOf(stage: Stage, week?: number): keyof typeof prompts {
  if (stage === "pregnancy") return (week ?? 0) >= 24 ? "late" : "pregnancy";
  if (stage === "planning" || stage === "trying") return "planning";
  if (stage === "postpartum" || stage === "infant") return "baby";
  return "child";
}

/** The quick journal's question for this week: by stage, rotating weekly (see rotationWeek). */
export function journalPrompt(stage: Stage, rotation: number, week?: number): string {
  return pick(prompts[poolOf(stage, week)], rotation);
}

const starters: Record<keyof typeof prompts, readonly string[]> = {
  pregnancy: ["Kicks kept me up, happily", "Nervous about the not-knowing", "Craving something odd", "Felt the baby move", "Tired but glad"],
  late: ["Kicks kept me up, happily", "Nervous about the not-knowing", "The bag is nearly packed", "Ready to meet you", "Counting the days"],
  planning: ["Excited and a little scared", "Wondering if we are ready", "A good talk tonight", "Feeling hopeful", "Needed a quiet day"],
  baby: ["Running on very little sleep", "A small win today", "A big smile today", "Found a rhythm, for now", "Needed a break"],
  child: ["A good moment with them today", "Feeling stretched thin", "So many questions today", "Proud of them", "A slow, nice evening"],
};

/** Starter lines to tap instead of typing: two from the stage's pool, rotating weekly, then one about the other parent. UI copy. */
export function journalStarters(stage: Stage, rotation: number, partnerName?: string, week?: number): string[] {
  const close = partnerName ? `Felt close to ${partnerName} today` : "Had a quiet good moment today";
  const pool = starters[poolOf(stage, week)];
  return [pick(pool, rotation), pick(pool, rotation + 1), close];
}

// ---------- Hospital bag ----------

export function bagByPerson(tasks: Task[]): { done: number; total: number; byMember: Map<string, number> } {
  const bag = tasks.filter((t) => t.bag);
  const byMember = new Map<string, number>();
  for (const t of bag) if (t.done && t.doneById) byMember.set(t.doneById, (byMember.get(t.doneById) ?? 0) + 1);
  return { done: bag.filter((t) => t.done).length, total: bag.length, byMember };
}

/** The mission to show on This week: one already taken and not finished, otherwise the first open one. */
export function pickMission(items: Mission[]): Mission | undefined {
  return items.find((m) => m.state === "taken") ?? items.find((m) => m.state === "open");
}
