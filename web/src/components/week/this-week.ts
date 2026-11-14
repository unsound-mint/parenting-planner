import type { LearningPath, Lesson, PregnancyWeek, QuizQuestion, Stage, Task } from "@/lib/api/types";

// Pure choices behind This week: which reads, which quiz, what the baby says.
// Kept apart from the components so the rules are in one readable place.

export type BabySize = NonNullable<PregnancyWeek["size"]>;

/** "head to heel" for crown-heel; the measure changes at week 20, so the label follows the data. */
export function lengthLabel(size: Pick<BabySize, "lengthMeasure" | "lengthCm">): string {
  const inches = (size.lengthCm / 2.54).toFixed(1);
  const what = size.lengthMeasure === "crown-heel" ? "head to heel" : size.lengthMeasure === "crown-rump" ? "head to bottom" : "length of the embryo";
  return size.lengthCm >= 2.54 ? `${what}, about ${inches} in` : what;
}

/** "about 1.7 lb" from the median weight; small weights stay in ounces. */
export function weightLabel(grams: number): string {
  const lb = grams / 453.6;
  return lb >= 1 ? `median, about ${lb.toFixed(1)} lb` : `median, about ${Math.round(grams / 28.35)} oz`;
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

/** The quick journal's question, by stage. UI copy, not health content. */
export function journalPrompt(stage: Stage, week?: number): string {
  if (stage === "pregnancy") return (week ?? 0) >= 24 ? "How are you feeling about the birth this week?" : "How are you feeling this week?";
  if (stage === "planning" || stage === "trying") return "How are you feeling about all this today?";
  if (stage === "postpartum" || stage === "infant") return "How are you holding up today?";
  return "How was today, for you?";
}

/** Starter lines to tap instead of typing. The API serves no journal prompts yet, so these are short UI copy per stage. */
export function journalStarters(stage: Stage, partnerName?: string): string[] {
  const close = partnerName ? `Felt close to ${partnerName} today` : "Had a quiet good moment today";
  if (stage === "pregnancy") return ["Kicks kept me up, happily", "Nervous about the not-knowing", close];
  if (stage === "planning" || stage === "trying") return ["Excited and a little scared", "Wondering if we are ready", close];
  if (stage === "postpartum" || stage === "infant") return ["Running on very little sleep", "A small win today", close];
  return ["A good moment with them today", "Feeling stretched thin", close];
}

// ---------- Hospital bag ----------

export function bagByPerson(tasks: Task[]): { done: number; total: number; byMember: Map<string, number> } {
  const bag = tasks.filter((t) => t.bag);
  const byMember = new Map<string, number>();
  for (const t of bag) if (t.done && t.doneById) byMember.set(t.doneById, (byMember.get(t.doneById) ?? 0) + 1);
  return { done: bag.filter((t) => t.done).length, total: bag.length, byMember };
}
