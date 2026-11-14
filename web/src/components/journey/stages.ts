import type { Family, Stage } from "@/lib/api/types";

// The path from planning to age 9. "Birth" is a milestone between Pregnancy
// and Newborn, so it has a node but no API stage of its own.
export type JourneyNode = { key: string; label: string; hint: string; milestone?: boolean };

export const journeyNodes: JourneyNode[] = [
  { key: "planning", label: "Planning", hint: "Getting ready" },
  { key: "pregnancy", label: "Pregnancy", hint: "40 weeks" },
  { key: "birth", label: "Birth", hint: "Meeting your baby", milestone: true },
  { key: "newborn", label: "Newborn", hint: "0 to 3 months" },
  { key: "first-year", label: "First year", hint: "3 to 12 months" },
  { key: "toddler", label: "Toddler", hint: "1 to 3 years" },
  { key: "preschool", label: "Preschool", hint: "3 to 6 years" },
  { key: "school-age", label: "School age to 9", hint: "6 to 9 years" },
];

const nodeIndex: Record<Stage, number> = {
  planning: 0,
  trying: 0,
  pregnancy: 1,
  postpartum: 3,
  infant: 4,
  toddler: 5,
  preschool: 6,
  school_age: 7,
};

// Age range in months covered by each child stage, to place the marker inside it.
const monthsRange: Partial<Record<Stage, [number, number]>> = {
  postpartum: [0, 3],
  infant: [3, 12],
  toddler: [12, 36],
  preschool: [36, 72],
  school_age: [72, 108],
};

const DAY = 86_400_000;

function utcToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function daysBetween(isoDate: string, from: number): number {
  return Math.round((from - new Date(isoDate).getTime()) / DAY);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Index of the current node and how far through it the family is (0 to 1). */
export function journeyPosition(family: Family): { index: number; progress: number; position: number } {
  const index = nodeIndex[family.stage];
  let progress = 0;
  if (family.stage === "pregnancy" && family.gestationalWeek != null) {
    progress = clamp01(family.gestationalWeek / 40);
  } else if (family.children[0] && monthsRange[family.stage]) {
    const [from, to] = monthsRange[family.stage]!;
    progress = clamp01((family.children[0].ageMonths - from) / (to - from));
  }
  // The last node has no next node to move towards.
  const position = index === journeyNodes.length - 1 ? index : index + progress;
  return { index, progress, position };
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function ageText(birthDate: string, ageMonths: number): string {
  const days = Math.max(0, daysBetween(birthDate, utcToday()));
  if (days < 14) return plural(days, "day");
  if (days < 84) return plural(Math.floor(days / 7), "week");
  if (ageMonths < 24) return plural(ageMonths, "month");
  const years = Math.floor(ageMonths / 12);
  const rest = ageMonths % 12;
  return rest === 0 ? plural(years, "year") : `${plural(years, "year")} and ${plural(rest, "month")}`;
}

/** Headline and a short follow-up sentence, both computed from the family's data. */
export function journeyHeadline(family: Family): { headline: string; support: string } {
  const child = family.children[0];
  if (family.stage === "pregnancy" && family.gestationalWeek != null) {
    const week = family.gestationalWeek;
    const left = family.dueDate
      ? Math.max(0, Math.ceil((new Date(family.dueDate).getTime() - utcToday()) / DAY / 7))
      : Math.max(0, 40 - week);
    const wait =
      left === 0
        ? "Your baby could arrive any day now."
        : `About ${plural(left, "week")} until you meet your baby.`;
    return { headline: `Week ${week} of 40. ${wait}`, support: "Birth is the next stop on the path." };
  }
  if (family.stage === "planning") {
    return { headline: "You are planning for a baby.", support: "There is no rush. The path starts here." };
  }
  if (family.stage === "trying") {
    return { headline: "You are trying for a baby.", support: "Planning and trying share the first stop on the path." };
  }
  if (child) {
    const next = journeyNodes[nodeIndex[family.stage] + 1];
    return {
      headline: `${child.name} is ${ageText(child.birthDate, child.ageMonths)} old.`,
      support: next ? `${next.label} is the next stop on the path.` : "You have come a long way together.",
    };
  }
  return { headline: "Here is where you are on the path.", support: "" };
}
