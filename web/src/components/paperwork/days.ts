/** Whole days from the family's today to an ISO date; negative once passed. Both are calendar days, so no time zone enters. */
export function daysFrom(today: string, isoDate: string): number {
  return Math.round((Date.parse(isoDate) - Date.parse(today)) / 86_400_000);
}

/** "today", "tomorrow", "11 days left". A date that has passed is a neutral "date passed", never a verdict. */
export function leftWords(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `${days} days left`;
  return "date passed";
}
