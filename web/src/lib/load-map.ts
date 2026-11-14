import { Baby, BookOpen, CalendarCheck, Clock, FileText, ListChecks, Milk, Moon, ShoppingBag, ShoppingBasket } from "lucide-react";
import type { LoadMapArea, LoadMapAreaKey, LoadMapShare } from "@/lib/api/types";
import type { Person } from "@/lib/roles";

// Helpers for "Who carries what". The API counts; this file only turns counts
// into bar fractions and warm sentences. Nothing here invents data.

export const areaIcon: Record<LoadMapAreaKey, typeof ListChecks> = {
  appointments: CalendarCheck,
  shopping: ShoppingBasket,
  paperwork: FileText,
  hospital_bag: ShoppingBag,
  learning: BookOpen,
  planning: ListChecks,
  feeding: Milk,
  diapers: Baby,
  nights: Moon,
  care_shifts: Clock,
};

/** A count a person carries in an area, 0 when they do not appear. */
export function countOf(shares: LoadMapShare[] | undefined, id: string): number {
  return shares?.find((s) => s.memberId === id)?.count ?? 0;
}

export function totalOf(shares: LoadMapShare[] | undefined): number {
  return (shares ?? []).reduce((n, s) => n + s.count, 0);
}

/**
 * The bar as stacked layers. Layer k is drawn from the left edge to the end of
 * person k's part, and layers are painted widest first. Only the scale of each
 * layer changes, so a handover is a transform, not a layout change.
 */
export function layers(shares: LoadMapShare[] | undefined, order: string[]): { id: string; end: number }[] {
  const total = totalOf(shares);
  const ids = [...order, ...(shares ?? []).map((s) => s.memberId).filter((id) => !order.includes(id))];
  let acc = 0;
  const out = ids.map((id) => {
    acc += countOf(shares, id);
    return { id, end: total ? acc / total : 0 };
  });
  return out.reverse();
}

const unitWord: Record<LoadMapArea["unit"], [string, string]> = {
  items: ["item", "items"],
  feeds: ["feed", "feeds"],
  changes: ["change", "changes"],
  entries: ["night entry", "night entries"],
  hours: ["hour a week", "hours a week"],
};

export function unitLabel(unit: LoadMapArea["unit"], n: number): string {
  return unitWord[unit][n === 1 ? 0 : 1];
}

/** Who picked up more of a care area in the last 7 days than in the 7 before, if anyone clearly did. */
export function pickedUp(area: LoadMapArea): string | undefined {
  let best: { id: string; gain: number } | undefined;
  for (const s of area.owned) {
    if (s.recentCount === undefined) continue;
    const gain = s.recentCount - (s.count - s.recentCount);
    if (gain >= 2 && (!best || gain > best.gain)) best = { id: s.memberId, gain };
  }
  return best?.id;
}

/**
 * One warm line per area, never a verdict. A care area says who has picked up
 * more lately; a task area where one parent carries everything offers the
 * handover in the same gentle terms; anything else says nothing.
 */
export function warmLine(area: LoadMapArea, self: Person, partner: Person | undefined, people: Person[]): string | undefined {
  const name = (id: string) => (id === self.id ? "You have" : `${people.find((p) => p.id === id)?.displayName ?? "Someone"} has`);
  const up = pickedUp(area);
  if (up) return `${name(up)} picked up ${area.label.toLowerCase()} this week.`;
  if (!partner || area.handoverTaskIds.length === 0) return undefined;
  const mine = countOf(area.owned, self.id);
  if (mine >= 2 && countOf(area.owned, partner.id) === 0) return `Want to hand over a whole area? ${partner.displayName} could own ${area.label.toLowerCase()}.`;
  return undefined;
}
