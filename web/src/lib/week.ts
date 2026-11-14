import type { Guide, PlanItem, PregnancyWeek, WeeklyPlan, WeeklyPlanPoint } from "@/lib/api/types";

// This week shows each fact once. The plan items from the rules engine own
// "what to do"; everything else on the page (the written note, the weekly
// card, the guides) only adds what the plan does not already say. These
// helpers decide which pieces overlap a plan item.

export type NoteParts = {
  /** The note's line for a plan item, by ruleId. */
  byRule: Record<string, WeeklyPlanPoint>;
  /** Points about nothing on this person's plan, for example the partner's booster. */
  loose: WeeklyPlanPoint[];
};

/** Splits the note into lines that sit on plan items and lines that stand alone. */
export function attachNote(items: PlanItem[], note?: WeeklyPlan): NoteParts | undefined {
  if (!note || note.fallback) return undefined;
  const byRule: Record<string, WeeklyPlanPoint> = {};
  const loose: WeeklyPlanPoint[] = [];
  for (const point of note.sections.flatMap((s) => s.points)) {
    // ruleId first; a point without one belongs to the item that cites the same guideline.
    const item =
      items.find((i) => i.ruleId === point.ruleId) ?? (point.ruleId ? undefined : items.find((i) => point.source && i.source.url === point.source.url));
    if (item && !byRule[item.ruleId]) byRule[item.ruleId] = point;
    else loose.push(point);
  }
  return Object.keys(byRule).length || loose.length ? { byRule, loose } : undefined;
}

// Words in rule and guide ids that name the stage or person, not the topic.
const GENERIC = new Set(["preg", "pregnancy", "mother", "mom", "partner", "baby", "newborn"]);
const topic = (id: string) => id.split(/[-_]/).filter((w) => w && !GENERIC.has(w));

/**
 * A guide repeats a plan item when it cites the same guideline or its id names
 * the same topic or category ("preg-tdap" and rule "tdap-pregnancy"). The contract has no
 * link between guides and rules yet; replace this with one when it does.
 */
export function guideRepeatsPlan(guide: Guide, items: PlanItem[]): boolean {
  const words = topic(guide.id);
  return items.some(
    (i) =>
      i.source.url === guide.source.url ||
      (topic(i.ruleId).length > 0 && topic(i.ruleId).every((w) => words.includes(w))) ||
      // "preg-partner-vaccines" is about the partner's "vaccine" item.
      words.some((w) => w.startsWith(i.category)),
  );
}

/**
 * The weekly card without what the plan already says. When the card cites the
 * same guideline as a plan item, its task, reason and questions are that item
 * again. Returns undefined when nothing new is left.
 */
export function weekCardBeyondPlan(card: PregnancyWeek, items: PlanItem[]): PregnancyWeek | undefined {
  const repeats = items.some((i) => i.source.url === card.source.url);
  const left: PregnancyWeek = repeats ? { ...card, tasks: [], questions: [], whyItMatters: "" } : card;
  const hasContent = left.size || left.development || left.whyItMatters || left.tasks.length || left.questions.length || left.birthPrep.length;
  return hasContent ? left : undefined;
}
