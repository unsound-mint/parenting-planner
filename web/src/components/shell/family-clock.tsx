"use client";

import { createContext, useContext } from "react";
import { shiftedNow } from "@/lib/clock";

const DaysAheadContext = createContext(0);

/** Gives client components the family's demo clock offset (see lib/clock.ts). */
export function FamilyClockProvider({ daysAhead, children }: { daysAhead: number; children: React.ReactNode }) {
  return <DaysAheadContext value={daysAhead}>{children}</DaysAheadContext>;
}

/** The family's "now" for client components: the real clock plus the demo skip. */
export function useFamilyNow(): Date {
  return shiftedNow(useContext(DaysAheadContext));
}
