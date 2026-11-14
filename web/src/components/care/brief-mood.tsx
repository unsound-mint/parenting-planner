import type { MoodSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Shared by the brief card and its printable page (a server component), so no "use client".

export function moodWords(m: MoodSummary): string {
  if (m.checkins === 0) return "No check-ins in the last two weeks.";
  const parts = [`${m.checkins} check-in${m.checkins === 1 ? "" : "s"}`, `${m.lowDays} low day${m.lowDays === 1 ? "" : "s"}`];
  if (m.averageSleep != null) parts.push(`sleep about ${m.averageSleep.toFixed(1)} h`);
  return parts.join(" · ");
}

/** Mood by day across the window, 1 at the bottom and 5 at the top; gaps stay gaps. */
export function Sparkline({ mood, className }: { mood: MoodSummary; className?: string }) {
  const from = Date.parse(mood.from);
  const span = Math.max(1, (Date.parse(mood.to) - from) / 86_400_000);
  const pts = mood.days.map((d) => ({ x: ((Date.parse(d.day) - from) / 86_400_000 / span) * 92 + 4, y: 26 - ((d.mood - 1) / 4) * 22, day: d.day }));
  const runs: (typeof pts)[] = [];
  pts.forEach((p, i) => {
    const prev = mood.days[i - 1];
    if (prev && (Date.parse(mood.days[i].day) - Date.parse(prev.day)) / 86_400_000 === 1) runs[runs.length - 1].push(p);
    else runs.push([p]);
  });
  return (
    <svg aria-hidden viewBox="0 0 100 30" className={cn("h-10 w-24 shrink-0 overflow-visible", className)}>
      <line x1="0" x2="100" y1="20.5" y2="20.5" stroke="var(--color-line-2)" strokeDasharray="2 2" strokeWidth="0.75" />
      {runs.map((r) => r.length > 1 && <polyline key={r[0].day} points={r.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--color-me)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
      {pts.map((p) => (
        <circle key={p.day} cx={p.x} cy={p.y} r="2.4" fill="var(--color-me)" />
      ))}
    </svg>
  );
}

