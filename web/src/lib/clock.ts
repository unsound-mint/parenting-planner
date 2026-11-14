import type { Family } from "@/lib/api/types";

const DAY_MS = 86_400_000;

/**
 * "Now" for this family's data. "Skip a week" moves the family's demo clock on
 * the server (Family.demoDaysAhead), so every due label, countdown and
 * today marker must start from this and never from the bare real clock.
 * Real wall-clock uses (toasts, "5 min ago" on entries made just now) stay on Date.
 */
export function familyNow(family: Pick<Family, "demoDaysAhead">): Date {
  return shiftedNow(family.demoDaysAhead ?? 0);
}

export function shiftedNow(daysAhead: number): Date {
  return new Date(Date.now() + daysAhead * DAY_MS);
}

// Preview mocks only: the mock middleware stores the session's offset before a
// fixture builds, so dayOf() and friends follow the skip. Not for components.
let mockDaysAhead = 0;
export const setMockDaysAhead = (n: number) => {
  mockDaysAhead = n;
};
export const mockNow = () => shiftedNow(mockDaysAhead);
