import type { Contraction } from "@/lib/labor";

const HOUR = 60 * 60_000;
const W = 600;
const H = 72;
/** Bars are drawn at least this wide, so a 20 second contraction is still visible on a phone. */
const MIN_W = 4;
const TICKS = [60, 45, 30, 15, 0];

/**
 * The last hour as soft bars on a line: each contraction sits where it
 * started, as wide as it lasted. A regular, closing rhythm reads at a glance
 * (evenly spaced, getting closer and wider) without any numbers. The one still
 * running grows with `now`. Not animated: it is data the parent is reading.
 */
export function RhythmBars({ list, now }: { list: readonly Contraction[]; now: number }) {
  const from = now - HOUR;
  const x = (t: number) => ((Math.max(t, from) - from) / HOUR) * W;
  const recent = list.filter((c) => (c.end ?? now) > from);
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="block h-auto w-full" role="img" aria-label={`${recent.length} contractions in the last hour`}>
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-line-2" strokeWidth="2" strokeLinecap="round" />
        {TICKS.map((m) => (
          <g key={m}>
            <line x1={W - (m / 60) * W} x2={W - (m / 60) * W} y1={H - 4} y2={H + 4} className="stroke-line-2" strokeWidth="2" />
            <text
              x={Math.min(Math.max(W - (m / 60) * W, 14), W - 14)}
              y={H + 17}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize="12"
            >
              {m === 0 ? "now" : `-${m}m`}
            </text>
          </g>
        ))}
        {recent.map((c) => {
          const left = x(c.start);
          const width = Math.max(x(c.end ?? now) - left, MIN_W);
          // Longer ones stand taller too, so strength reads as height as well as width.
          const secs = ((c.end ?? now) - c.start) / 1000;
          const h = 22 + Math.min(secs / 90, 1) * (H - 30);
          return <rect key={c.start} x={left} y={H - h} width={width} height={h} rx={Math.min(width / 2, 6)} className={c.end == null ? "fill-me" : "fill-me-mid"} />;
        })}
      </svg>
    </figure>
  );
}
