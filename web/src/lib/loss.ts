import type { Family } from "@/lib/api/types";

// Pregnancy loss support (Family.pregnancyLoss). While it is set the server
// moves the family to planning and clears the due date, so most pregnancy UI
// stops on its own. Anything the web derives from the stage or due date, or
// that would still read as "expecting" (the simulator, baby prep), checks this.
// Caregivers get the same family but must never be told why: never render the
// reason, a date or support content for a grandparent or nanny.
export function inLossSupport(family: Pick<Family, "pregnancyLoss">): boolean {
  return family.pregnancyLoss != null;
}
