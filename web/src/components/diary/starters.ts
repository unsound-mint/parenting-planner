import type { Stage } from "@/lib/api/types";

// Ways into a blank entry, by stage: openers the parent finishes, never
// statements about how they feel. Plain UI copy, not health guidance.
const byStage: Partial<Record<Stage, string[]>> = {
  pregnancy: ["The baby moved when", "What I keep thinking about the birth is", "I felt close to {partner} when"],
  postpartum: ["Last night was", "Feeding today felt", "One thing I needed help with"],
  infant: ["Last night was", "Something new the baby did", "One thing I needed help with"],
  toddler: ["Today we laughed about", "The hardest moment today", "Something I want to remember"],
  preschool: ["Today we laughed about", "The hardest moment today", "Something I want to remember"],
  school_age: ["Today we talked about", "The hardest moment today", "Something I want to remember"],
};
const general = ["Today I felt", "Something small that went well", "What I need this week"];

export function startersFor(stage: Stage | undefined, partner?: string): string[] {
  const list = (stage && byStage[stage]) || general;
  return list.filter((s) => partner || !s.includes("{partner}")).map((s) => s.replace("{partner}", partner ?? "") + " ");
}
