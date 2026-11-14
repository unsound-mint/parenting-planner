import type { Family, FertilityEntry } from "@/lib/api/types";

// Fertility helpers shared by the journal, the chart and the checklist.
// The API stores temperature in Celsius; the US screens show Fahrenheit first.

export const cToF = (c: number) => c * 1.8 + 32;
export const fToC = (f: number) => Math.round(((f - 32) / 1.8) * 100) / 100;
/** "97.9 °F". */
export const formatF = (c: number) => `${cToF(c).toFixed(1)} °F`;
/** "97.9 °F (36.6 °C)": US first, metric small after it. */
export const formatTemp = (c: number) => `${formatF(c)} (${c.toFixed(1)} °C)`;

export const flowLabel = { spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" } as const;
export const flows = ["light", "medium", "heavy", "spotting"] as const;

export const symptomLabel: Record<string, string> = {
  cramps: "Cramps",
  headache: "Headache",
  breast_tenderness: "Tender breasts",
  bloating: "Bloating",
  mood_change: "Mood change",
  fatigue: "Tired",
  nausea: "Nausea",
  fertile_mucus: "Egg-white mucus",
  low_energy: "Low energy",
};
export const symptoms = Object.keys(symptomLabel);

export const testLabel = { negative: "Negative", faint: "Faint line", positive: "Positive" } as const;
export const tests = ["negative", "faint", "positive"] as const;

const DAY = 86_400_000;
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Whole days from a to b (ISO dates). */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);
export const addDays = (iso: string, n: number) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);
/** The family's today as an ISO date; pass familyNow(family). */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The planning journal is for planning and trying families, never during pregnancy loss support. */
export function inPlanningJournal(family: Pick<Family, "stage" | "pregnancyLoss">): boolean {
  return (family.stage === "planning" || family.stage === "trying") && family.pregnancyLoss == null;
}

export function entriesOf(list: FertilityEntry[], kind: FertilityEntry["kind"]) {
  return list.filter((e) => e.kind === kind);
}

/** "tomorrow", "in 5 days", "today", "2 days ago". */
export function relativeDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
