import type { LearningPath, LibraryStage, LibraryTopicSummary, LibraryUpcoming, Stage } from "@/lib/api/types";
import { finishedBy, readOf } from "@/components/learn/model";
import { categoryOrder, words } from "./visuals";

// The Learn library as one catalogue: sourced topics (Questions), lessons from
// the family's paths, and coming-soon titles. Everything comes from the API;
// this file only merges, filters and orders it.

export type Format = "article" | "lesson" | "quiz";
export type Length = "short" | "medium" | "long";

export type LibraryItem = {
  id: string;
  title: string;
  /** One line under the title: the parent's question, the path, or what a coming-soon piece will cover. */
  line: string;
  category: string;
  stages: LibraryStage[];
  minutes: number;
  format: Format;
  /** Where it opens; undefined for coming soon. */
  href?: string;
  soon: boolean;
  /** The topic covers the family's moment right now. */
  now: boolean;
  /** Read state the API knows (lessons only for now). */
  state?: "read" | "reading" | "new";
  /** Searchable words. */
  words: string[];
};

export const stageLabels: Record<LibraryStage, string> = {
  planning: "Getting ready",
  pregnancy: "Pregnancy",
  newborn: "First year",
  toddler: "Toddler",
  preschool: "Preschool",
  school: "School age",
};
export const stageOrder = Object.keys(stageLabels) as LibraryStage[];

export const formatLabels: Record<Format, string> = { article: "Articles", lesson: "Lessons", quiz: "Quizzes" };
export const lengthLabels: Record<Length, string> = { short: "Up to 3 min", medium: "4 to 6 min", long: "7 min or more" };
export const lengthOf = (minutes: number): Length => (minutes <= 3 ? "short" : minutes <= 6 ? "medium" : "long");

/** The family's place on the library's stage line, from the content stage the API filters lessons by. */
export function libraryStage(stage: Stage): LibraryStage {
  switch (stage) {
    case "planning":
    case "trying":
      return "planning";
    case "pregnancy":
      return "pregnancy";
    case "postpartum":
    case "infant":
      return "newborn";
    case "school_age":
      return "school";
    default:
      return stage;
  }
}

/** Lessons have no topic category; map each path to the shelf it reads like. */
function pathCategory(p: LearningPath): string {
  const t = `${p.id} ${p.title}`.toLowerCase();
  if (/birth|labou?r|hospital/.test(t)) return "birth";
  if (/feed|food|eat|nutrition/.test(t)) return "feeding";
  if (/sleep|night/.test(t)) return "sleep";
  if (/safe/.test(t)) return "safety";
  if (/couple|partner|together|you\b|wellbeing/.test(t)) return "parent-wellbeing";
  if (/feel|emotion|calm|tantrum|behav/.test(t)) return "emotions";
  if (/school|learn|play|talk|language/.test(t)) return "learning";
  if (/money|work|leave/.test(t)) return "money";
  return "development";
}

export function buildCatalogue({
  memberId,
  topics,
  upcoming,
  paths,
  stage,
}: {
  memberId: string;
  topics: LibraryTopicSummary[];
  upcoming: LibraryUpcoming[];
  paths: LearningPath[];
  stage: LibraryStage;
}): LibraryItem[] {
  const base = `/family/${memberId}/learn`;
  const out: LibraryItem[] = [];
  for (const t of topics) {
    out.push({
      id: t.id,
      title: t.title,
      line: t.questions[0] ?? t.ages,
      category: t.category,
      stages: t.stages,
      minutes: t.minutes,
      format: "article",
      href: `${base}/questions?topic=${encodeURIComponent(t.id)}`,
      soon: false,
      now: t.now,
      words: words([t.title, ...t.questions].join(" ")),
    });
  }
  for (const p of paths) {
    const category = pathCategory(p);
    for (const l of p.lessons) {
      const state = finishedBy(l, memberId) ? "read" : readOf(l, memberId) ? "reading" : "new";
      out.push({
        id: `lesson-${l.id}`,
        title: l.title,
        line: p.title,
        category,
        stages: [stage],
        minutes: l.minutes,
        format: "lesson",
        href: `${base}?path=${encodeURIComponent(p.id)}&lesson=${encodeURIComponent(l.id)}`,
        soon: false,
        now: l.timing === "now",
        state,
        words: words(`${l.title} ${p.title}`),
      });
    }
  }
  for (const u of upcoming) {
    out.push({
      id: u.id,
      title: u.title,
      line: u.summary,
      category: u.category,
      stages: u.stages,
      minutes: u.minutes,
      format: u.format === "quiz" ? "quiz" : "article",
      soon: true,
      now: false,
      words: words(`${u.title} ${u.summary}`),
    });
  }
  return out;
}

/**
 * Relevance to the family: what covers their moment now, then their stage,
 * then readable before coming soon. Stable, so the API's own order (now first,
 * narrowest span on top) breaks ties.
 */
export function byRelevance(items: LibraryItem[], stage: LibraryStage): LibraryItem[] {
  const score = (i: LibraryItem) => (i.now ? 0 : 2) + (i.stages.includes(stage) ? 0 : 4) + (i.soon ? 1 : 0);
  return items
    .map((item, at) => ({ item, at, s: score(item) }))
    .sort((a, b) => a.s - b.s || a.at - b.at)
    .map((x) => x.item);
}

/** Categories as shelves: the family's busiest topics first, the chip order breaking ties. */
export function shelvesOf(items: LibraryItem[], stage: LibraryStage): { category: string; items: LibraryItem[] }[] {
  const by = new Map<string, LibraryItem[]>();
  for (const i of items) by.set(i.category, [...(by.get(i.category) ?? []), i]);
  const rank = (c: string) => (categoryOrder.indexOf(c) + categoryOrder.length + 1) % (categoryOrder.length + 1);
  const forStage = (list: LibraryItem[]) => list.filter((i) => i.stages.includes(stage) && !i.soon).length;
  return [...by.entries()]
    .map(([category, list]) => ({ category, items: byRelevance(list, stage) }))
    .sort((a, b) => forStage(b.items) - forStage(a.items) || rank(a.category) - rank(b.category));
}

export const counts = (items: LibraryItem[]) => {
  const soon = items.filter((i) => i.soon).length;
  return { ready: items.length - soon, soon };
};
