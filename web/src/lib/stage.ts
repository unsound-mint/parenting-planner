import type { Family } from "@/lib/api/types";

// What a family at each end of the journey does and does not have. The screens
// built for a baby at home (feeds and diapers, night shifts, the newborn
// practice rounds) do not fit a family that is planning or has a child past toddler.

/** A child old enough that the baby log, night shifts and newborn practice do not apply. */
export function hasOlderChild(family: Pick<Family, "stage">): boolean {
  return family.stage === "toddler" || family.stage === "preschool" || family.stage === "school_age";
}

/** Planning or trying: no due date, no child. */
export function isPlanning(family: Pick<Family, "stage">): boolean {
  return family.stage === "planning" || family.stage === "trying";
}
