/** The line a share card, its alt text and the share sheet all use: "Week 25: about the size of a zucchini". */
export function pregnancyShareLine(week: number, comparison: string): string {
  return `Week ${week}: about the size of ${comparison}`;
}

/** Longest nickname the card takes. The image route enforces it again. */
export const NICKNAME_MAX = 24;

/** What the card may show beyond the baby and the week: a nickname the sharer typed, nothing else. */
export function cleanNickname(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX);
}
