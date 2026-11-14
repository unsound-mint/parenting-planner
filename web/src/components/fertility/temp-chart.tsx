"use client";

import { useEffect, useState } from "react";
import type { FertilityEntry } from "@/lib/api/types";
import { addDays, cToF, daysBetween, formatTemp } from "@/lib/fertility";
import { formatShortDate } from "@/lib/format";

type Props = {
  /** The acting parent's own entries. */
  entries: FertilityEntry[];
  today: string;
  /** Estimated window as ISO dates; absent before an estimate exists. */
  window?: { start: string; end: string };
};

const BACK = 27;
const AHEAD = 10;
const W = 640;
const H = 220;
const PAD = { l: 44, r: 12, t: 16, b: 34 };

/**
 * Basal body temperature (°F, metric in the table) over the last four weeks, with the
 * days of bleeding along the bottom, positive ovulation tests as hollow diamonds and the
 * estimated fertile window as a green band. A temperature rise only shows that ovulation
 * has already happened (ACOG), so the band and the line are never read together as a
 * prediction. One series, so no categorical palette; the legend names every mark and a
 * table view holds the same numbers.
 */
export function TempChart({ entries, today, window: win }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const start = addDays(today, -BACK);
  const span = BACK + AHEAD;
  const x = (iso: string) => PAD.l + (daysBetween(start, iso) / span) * (W - PAD.l - PAD.r);
  const inRange = (iso: string) => daysBetween(start, iso) >= 0 && daysBetween(start, iso) <= span;

  const temps = entries
    .filter((e) => e.kind === "bbt" && e.tempC != null && inRange(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const f = temps.map((e) => cToF(e.tempC as number));
  const lo = f.length ? Math.floor((Math.min(...f) - 0.2) * 2) / 2 : 97;
  const hi = f.length ? Math.ceil((Math.max(...f) + 0.2) * 2) / 2 : 99;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 0.001; v += 0.5) ticks.push(v);

  const pts = temps.map((e, i) => `${x(e.date).toFixed(1)},${y(f[i]).toFixed(1)}`);
  const period = entries.filter((e) => e.kind === "period" && e.code !== "spotting" && inRange(e.date));
  const positives = entries.filter((e) => e.kind === "ovulation_test" && e.code === "positive" && inRange(e.date));
  const bar = (W - PAD.l - PAD.r) / span;
  const weekMarks = [-BACK, -BACK + 7, -BACK + 14, -BACK + 21, 0, 7].map((o) => addDays(today, o));

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Basal body temperature over the last four weeks, with bleeding days, positive ovulation tests and the estimated fertile window">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {win && inRange(win.start) && (
          <g>
            <rect
              x={x(win.start) - bar / 2}
              y={PAD.t}
              width={(Math.min(daysBetween(start, win.end), span) - Math.max(daysBetween(start, win.start), 0) + 1) * bar}
              height={H - PAD.t - PAD.b}
              rx="8"
              className="fill-leaf/15"
            />
            <text x={x(win.start) - bar / 2 + 6} y={PAD.t + 14} className="fill-leaf font-mono text-[11px]">
              Estimated window
            </text>
          </g>
        )}
        {period.map((e) => (
          <rect key={e.id} x={x(e.date) - bar / 2 + 1} y={H - PAD.b - 7} width={bar - 2} height="7" rx="2" className="fill-me" />
        ))}
        <line x1={x(today)} x2={x(today)} y1={PAD.t} y2={H - PAD.b} className="stroke-ink" strokeWidth="1.5" strokeDasharray="3 4" />
        <text x={x(today)} y={H - PAD.b + 28} textAnchor="middle" className="fill-ink font-mono text-[11px]">
          Today
        </text>
        {weekMarks
          .filter((d) => d !== today)
          .map((d) => (
            <text key={d} x={x(d)} y={H - PAD.b + 28} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
              {formatShortDate(d)}
            </text>
          ))}
        {pts.length > 1 && (
          <polyline
            points={pts.join(" ")}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="stroke-ink"
            style={{ strokeDasharray: 1, strokeDashoffset: ready ? 0 : 1, transition: "stroke-dashoffset 900ms var(--ease-out)" }}
          />
        )}
        {temps.map((e, i) => (
          <circle key={e.id} cx={x(e.date)} cy={y(f[i])} r="4" className="fill-card stroke-ink" strokeWidth="2">
            <title>{`${formatShortDate(e.date)}: ${formatTemp(e.tempC as number)}`}</title>
          </circle>
        ))}
        {positives.map((e) => (
          <g key={e.id} transform={`translate(${x(e.date)} ${PAD.t + 30})`}>
            <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" className="fill-sun-2 stroke-ink" strokeWidth="1.5" />
            <title>{`${formatShortDate(e.date)}: positive ovulation test`}</title>
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted-foreground">
        <Key swatch={<span className="size-2.5 rounded-full border-2 border-ink bg-card" />}>Temperature, °F</Key>
        <Key swatch={<span className="h-2 w-3.5 rounded-sm bg-me" />}>Bleeding</Key>
        <Key swatch={<span className="size-2.5 rotate-45 border border-ink bg-sun-2" />}>Positive ovulation test</Key>
        <Key swatch={<span className="h-2.5 w-3.5 rounded-sm bg-leaf/15" />}>Estimated fertile window</Key>
      </figcaption>
      <details className="text-label">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted-foreground underline decoration-line-2 underline-offset-3 hover:text-ink md:min-h-9">View as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left font-mono text-caption">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Date</th>
              <th className="py-1 font-normal">Temperature</th>
            </tr>
          </thead>
          <tbody>
            {[...temps].reverse().map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="py-1">{formatShortDate(e.date)}</td>
                <td className="py-1">{formatTemp(e.tempC as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Key({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}
