import { cn } from "@/lib/utils";

export type RingSegment = { value: number; className: string };

const R = 28;
const C = 2 * Math.PI * R;

// A progress ring made of coloured arcs on a muted track. Colours come in as
// text-* classes (the arcs use currentColor). The centre is a slot for the figure.
export function Ring({ segments, total, label, children }: { segments: RingSegment[]; total: number; label: string; children: React.ReactNode }) {
  const live = segments.filter((s) => s.value > 0);
  const gap = live.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="relative size-20 shrink-0" role="img" aria-label={label}>
      <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
        {total > 0 &&
          live.map((s, i) => {
            const len = (s.value / total) * C;
            const dash = Math.max(len - gap, 0.5);
            const el = (
              <circle
                key={i}
                cx="36"
                cy="36"
                r={R}
                fill="none"
                strokeWidth="8"
                stroke="currentColor"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                className={cn(s.className)}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
