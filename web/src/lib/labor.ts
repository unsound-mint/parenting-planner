import type { Source } from "@/lib/api/types";

// Getting ready for birth: the contraction timer's rules and the sources the
// labor coach cites. Pure functions, so the timer, its threshold card and the
// rhythm bars all read the same numbers. Nothing here diagnoses: a rule says
// whether the timed pattern matches what a guideline or the family's provider
// told them to call about, never whether labor is "real".

const CHECKED = "2026-11-14";

export const LABOR_SOURCES = {
  nichdStart: { title: "NICHD: Start of Labor", url: "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/start-of-labor", checkedAt: CHECKED },
  nhsSigns: { title: "NHS: Signs that labour has begun", url: "https://www.nhs.uk/pregnancy/labour-and-birth/signs-of-labour/signs-that-labour-has-begun/", checkedAt: CHECKED },
  cdcHearHer: { title: "CDC Hear Her: Urgent maternal warning signs", url: "https://www.cdc.gov/hearher/maternal-warning-signs/index.html", checkedAt: CHECKED },
  eohuBreathing: { title: "Eastern Ontario Health Unit: Breathing techniques for labour and delivery", url: "https://eohu.ca/en/my-health/breathing-techniques-for-labour-and-delivery", checkedAt: CHECKED },
  lothian: { title: "Lothian 2011, Lamaze breathing (J Perinat Educ)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3209750/", checkedAt: CHECKED },
  cochraneRelax: { title: "Cochrane 2018: Relaxation techniques for pain management in labour", url: "https://pubmed.ncbi.nlm.nih.gov/29589650/", checkedAt: CHECKED },
  cochraneMassage: { title: "Cochrane 2018: Massage and other manual methods for pain in labour", url: "https://pubmed.ncbi.nlm.nih.gov/29589380/", checkedAt: CHECKED },
  cochraneSupport: { title: "Cochrane 2017: Continuous support for women during childbirth", url: "https://pubmed.ncbi.nlm.nih.gov/28681500/", checkedAt: CHECKED },
  cochranePerineal: { title: "Cochrane 2013: Antenatal perineal massage", url: "https://pubmed.ncbi.nlm.nih.gov/23633325/", checkedAt: CHECKED },
  nichdPain: { title: "NICHD: Pain relief during labor and delivery", url: "https://www.nichd.nih.gov/health/topics/labor-delivery/topicinfo/pain-relief", checkedAt: CHECKED },
  cdcCarSeat: { title: "CDC: Child passenger safety", url: "https://www.cdc.gov/child-passenger-safety/about/index.html", checkedAt: CHECKED },
} satisfies Record<string, Source>;

/** One timed contraction, as epoch milliseconds. `end` is missing while it is still going. */
export type Contraction = { start: number; end?: number };

/**
 * When to call, as the family's provider (or a guideline) put it: contractions
 * at most `everyMin` minutes apart, start to start, for at least `forMin` minutes.
 * `lastsSec` optionally asks that each one lasts that long too.
 */
export type CallRule = { everyMin: number; forMin: number; lastsSec?: number };

/** NICHD: "regular contractions every 5 to 10 minutes for an hour should let their health care provider know". */
export const NICHD_RULE: CallRule = { everyMin: 10, forMin: 60 };

/** NICHD: labor before 37 weeks is preterm; regular, frequent contractions then mean call or go in. */
export const PRETERM_BEFORE_WEEK = 37;

const MIN = 60_000;

export type Timed = Contraction & { duration?: number; interval?: number };

/** Oldest first, each with its duration (ms) and the interval from the previous start (ms). */
export function withIntervals(list: readonly Contraction[]): Timed[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  return sorted.map((c, i) => ({
    ...c,
    duration: c.end != null ? c.end - c.start : undefined,
    interval: i > 0 ? c.start - sorted[i - 1].start : undefined,
  }));
}

/**
 * The run of contractions that ends with the latest one and keeps every
 * interval within the rule. Broken by a longer gap, or once the next one is
 * overdue (the latest started more than `everyMin` ago), so a pattern that
 * faded out stops matching.
 */
export function currentRun(list: readonly Contraction[], rule: CallRule, now: number): Timed[] {
  const timed = withIntervals(list);
  const last = timed.at(-1);
  if (!last || now - last.start > rule.everyMin * MIN) return [];
  let i = timed.length - 1;
  while (i > 0 && (timed[i].interval ?? Infinity) <= rule.everyMin * MIN) i--;
  return timed.slice(i);
}

export type RuleCheck = {
  /** The pattern matches the rule: show "Time to call your provider". */
  matches: boolean;
  /** Minutes the current run has lasted, start of its first contraction to now. */
  runMin: number;
  /** Contractions in the current run. */
  count: number;
};

/** At least three in a row before anything counts as a pattern, so two close ones never trigger the card. */
const MIN_RUN = 3;

export function checkRule(list: readonly Contraction[], rule: CallRule, now: number): RuleCheck {
  const run = currentRun(list, rule, now);
  const runMin = run.length ? (now - run[0].start) / MIN : 0;
  const longEnough = rule.lastsSec == null || run.filter((c) => c.duration != null).every((c) => c.duration! >= rule.lastsSec! * 1000);
  return { matches: run.length >= MIN_RUN && runMin >= rule.forMin && longEnough, runMin, count: run.length };
}

/**
 * Before 37 weeks NICHD says regular, frequent contractions at any point mean
 * notify a provider or go to the hospital, with no hour to wait. "Regular" here
 * is three or more in a row at most 10 minutes apart.
 */
export function pretermPattern(list: readonly Contraction[], week: number | undefined, now: number): boolean {
  if (week == null || week >= PRETERM_BEFORE_WEEK) return false;
  return currentRun(list, { everyMin: 10, forMin: 0 }, now).length >= MIN_RUN;
}

/**
 * NHS: call your maternity unit urgently if any contraction lasts longer than
 * 2 minutes, or there are 6 or more in 10 minutes. Checked over the last hour.
 */
export function urgentPattern(list: readonly Contraction[], now: number): boolean {
  const recent = list.filter((c) => now - c.start <= 60 * MIN);
  if (recent.some((c) => (c.end ?? now) - c.start > 2 * MIN)) return true;
  const starts = recent.map((c) => c.start).sort((a, b) => a - b);
  return starts.some((s, i) => i + 5 < starts.length && starts[i + 5] - s <= 10 * MIN);
}

/** "1:05" for 65 seconds; "12:40" for minutes. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** localStorage keys, per family: a demo reset makes a new family copy, so it starts clean. */
export const timerKey = (familyId: string) => `pp-labor-timer:${familyId}`;
export const ruleKey = (familyId: string) => `pp-labor-rule:${familyId}`;
