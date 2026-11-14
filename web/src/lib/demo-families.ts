import type { DemoTemplate, Stage } from "@/lib/api/types";

// The four synthetic families the API seeds (api/internal/demo), as the start
// page shows them. There is no endpoint that lists them, so keep this in step
// with the seed: same names, stage and the first thing each family's plan
// finds. Add an entry only when the seed exists.
export type DemoFamilyCard = {
  template: Exclude<DemoTemplate, "custom">;
  stage: Stage;
  /** Short stage name for the card ("2nd trimester"). */
  stageLabel: string;
  /** Where the family is, as a sentence. */
  title: string;
  parents: { name: string; role: "mother" | "partner" }[];
  /** What this family's plan opens with, one line. */
  firstUp: string;
};

export const demoFamilies: DemoFamilyCard[] = [
  {
    template: "planning",
    stage: "planning",
    stageLabel: "Planning",
    title: "Planning a first baby",
    parents: [
      { name: "Maya", role: "mother" },
      { name: "Daniel", role: "partner" },
    ],
    firstUp: "Rubella immunity gap and no MMR on record, before trying.",
  },
  {
    template: "pregnancy",
    stage: "pregnancy",
    stageLabel: "2nd trimester",
    title: "25 weeks pregnant",
    parents: [
      { name: "Emily", role: "mother" },
      { name: "Jake", role: "partner" },
    ],
    firstUp: "Glucose screen window opens, Tdap in two weeks.",
  },
  {
    template: "newborn",
    stage: "postpartum",
    stageLabel: "Newborn",
    title: "Leo is 7 weeks old",
    parents: [
      { name: "Aisha", role: "mother" },
      { name: "Marcus", role: "partner" },
    ],
    firstUp: "2-month vaccines, the postpartum visit, and Marcus's low sleep.",
  },
  {
    template: "preschool",
    stage: "preschool",
    stageLabel: "Preschooler",
    title: "Ava is 4",
    parents: [
      { name: "Rachel", role: "mother" },
      { name: "Tom", role: "partner" },
    ],
    firstUp: "4-to-6-year boosters, and no vision screening on file.",
  },
];

/** The stages the start page draws as a rail, in order. */
export const stageRail: { stage: Stage; label: string }[] = [
  { stage: "planning", label: "Planning" },
  { stage: "pregnancy", label: "Pregnancy" },
  { stage: "postpartum", label: "Newborn" },
  { stage: "toddler", label: "Toddler" },
  { stage: "preschool", label: "Preschool" },
];

/** Position of a stage on the rail; infant sits with the newborn node. */
export function railIndex(stage: Stage): number {
  const i = stageRail.findIndex((s) => s.stage === (stage === "infant" ? "postpartum" : stage));
  return i === -1 ? (stage === "school_age" ? stageRail.length - 1 : 0) : i;
}

// What createCustomSession accepts (api/openapi.yaml, /demo/custom-sessions).
// The server checks again; these only keep the form from sending what it will refuse.
export type CustomStage = {
  stage: Stage;
  label: string;
  hint: string;
  date: "none" | "due" | "birth";
  /** Child age window in months, for birth-date stages. */
  months?: [min: number, max: number];
};

export const customStages: CustomStage[] = [
  { stage: "planning", label: "Planning a baby", hint: "No dates needed", date: "none" },
  { stage: "trying", label: "Trying to conceive", hint: "No dates needed", date: "none" },
  { stage: "pregnancy", label: "Pregnant", hint: "Due date", date: "due" },
  { stage: "postpartum", label: "Newborn, under 3 months", hint: "Birth date", date: "birth", months: [0, 3] },
  { stage: "infant", label: "Baby, 3 to 11 months", hint: "Birth date", date: "birth", months: [3, 12] },
  { stage: "toddler", label: "Toddler, 1 to 2 years", hint: "Birth date", date: "birth", months: [12, 36] },
  { stage: "preschool", label: "Preschooler, 3 to 4 years", hint: "Birth date", date: "birth", months: [36, 60] },
  { stage: "school_age", label: "School age, 5 to 9 years", hint: "Birth date", date: "birth", months: [60, 120] },
];

/** The earliest and latest date the form offers for a stage, as YYYY-MM-DD in local time. */
export function dateWindow(s: CustomStage, today: Date): { min: string; max: string } | undefined {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  if (s.date === "due") return { min: key(shift(-14)), max: key(shift(280)) };
  if (s.date === "birth" && s.months) {
    const [lo, hi] = s.months;
    // Age is whole months: the oldest child is one day short of `hi` months.
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    return {
      min: key(new Date(y, m - hi, d + 1)),
      max: lo === 0 ? key(today) : key(new Date(y, m - lo, d)),
    };
  }
  return undefined;
}
