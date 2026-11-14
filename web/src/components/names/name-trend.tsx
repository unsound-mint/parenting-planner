import { cn } from "@/lib/utils";

// A name's US popularity over the decades as a small sparkline: one quiet line
// over the SSA trend years, the latest year as a dot in the acting parent's
// accent. Single series, so no legend; the figure next to it names the value,
// and each point carries its year and count as a tooltip and for screen readers.

const W = 120;
const H = 32;
const PAD = 4;

export function NameTrend({ years, counts, className }: { years: readonly number[]; counts: readonly number[]; className?: string }) {
  const n = Math.min(years.length, counts.length);
  if (n < 2) return null;
  const max = Math.max(1, ...counts.slice(0, n));
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const points = Array.from({ length: n }, (_, i) => `${x(i).toFixed(1)},${y(counts[i]).toFixed(1)}`).join(" ");
  const label = `US babies per year: ${Array.from({ length: n }, (_, i) => `${years[i]} ${counts[i].toLocaleString("en-US")}`).join(", ")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={cn("h-8 w-30 shrink-0 overflow-visible", className)}>
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-line" strokeWidth={1} />
      <polyline points={points} fill="none" className="stroke-muted-foreground/70" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(counts[n - 1])} r={4} className="fill-me stroke-card" strokeWidth={2} />
      {Array.from({ length: n }, (_, i) => (
        <rect key={years[i]} x={x(i) - (W - PAD * 2) / (n - 1) / 2} y={0} width={(W - PAD * 2) / (n - 1)} height={H} fill="transparent">
          <title>{`${years[i]}: ${counts[i].toLocaleString("en-US")} babies`}</title>
        </rect>
      ))}
    </svg>
  );
}
