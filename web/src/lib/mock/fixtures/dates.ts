// Fixture dates are relative to now so a preview never goes stale.
const DAY = 86_400_000;

export const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** A date-time offsetDays from now, at a fixed UTC hour. */
export const isoAt = (offsetDays: number, hourUtc: number, minute = 0) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d.toISOString();
};

/** Stable fake uuid so fixtures stay identical between renders. */
export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// The demo family. Checked date for every guideline source below.
export const CHECKED = "2026-11-14";
