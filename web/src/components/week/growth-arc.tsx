import { weekFraction } from "./this-week";
import "./week.css";

// The pregnancy as one soft path from week 4 to week 40, with a dot every four
// weeks and "you are here". The art box keeps the viewBox's aspect ratio, so a
// point on the path maps to the same percentage of the box at every width and
// the baby (positioned by the hero from arcPoint) sits on its dot without
// measuring anything in the browser.

export const ARC_W = 760;
export const ARC_H = 470;
const P = [
  [60, 420],
  [200, 330],
  [520, 320],
  [720, 230],
] as const;
const D = `M${P[0].join(" ")} C ${P[1].join(" ")}, ${P[2].join(" ")}, ${P[3].join(" ")}`;

function bezier(t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}

// Arc-length table, so weeks are evenly spaced along the curve, not along t.
const SAMPLES = 120;
const table = (() => {
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => bezier(i / SAMPLES));
  const len = [0];
  for (let i = 1; i <= SAMPLES; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[SAMPLES] };
})();

/** The point at a fraction of the arc's length, in viewBox units. */
export function arcPoint(fraction: number): [number, number] {
  const target = fraction * table.total;
  const i = table.len.findIndex((l) => l >= target);
  // -1: past the end through rounding, so the last point.
  if (i < 0) return table.pts[table.pts.length - 1];
  if (i === 0) return table.pts[0];
  const span = table.len[i] - table.len[i - 1];
  const k = span ? (target - table.len[i - 1]) / span : 0;
  const [x0, y0] = table.pts[i - 1], [x1, y1] = table.pts[i];
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
}

export function GrowthArc({ week, startLabel, endLabel }: { week: number; startLabel: string; endLabel: string }) {
  const f = weekFraction(week);
  const [nx, ny] = arcPoint(f);
  const dots = Array.from({ length: 10 }, (_, i) => 4 + i * 4).map((w) => ({ w, p: arcPoint(weekFraction(w)), past: w < week }));
  return (
    <svg viewBox={`0 0 ${ARC_W} ${ARC_H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden focusable="false">
      <defs>
        {/* The walked part of the line: the full path, clipped to everything left of today. */}
        <clipPath id="pp-wk-walked">
          <rect className="pp-wk-arc-clip" x="0" y="0" width={nx} height={ARC_H} />
        </clipPath>
      </defs>
      <path d={`M-20 ${ARC_H} C 120 360, 300 330, 430 360 S 700 420, 800 340 L 800 ${ARC_H} Z`} className="fill-sun-2" opacity=".55" />
      <path d={D} fill="none" className="stroke-[#E9C9A1]" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      <path d={D} fill="none" className="stroke-me-mid" strokeWidth="3" strokeLinecap="round" clipPath="url(#pp-wk-walked)" />
      {dots.map(({ w, p, past }) =>
        past ? (
          <circle key={w} cx={p[0]} cy={p[1]} r={3 + (w / 40) * 6} className="fill-me-mid" />
        ) : (
          <circle key={w} cx={p[0]} cy={p[1]} r={3 + (w / 40) * 6} fill="#FFF5E2" className="stroke-[#E9C9A1]" strokeWidth="2" />
        ),
      )}
      <g className="pp-wk-arc-now">
        <circle cx={nx} cy={ny} r="13" className="fill-me" />
        <circle cx={nx} cy={ny} r="5" fill="#fff" />
      </g>
      <text
        x={Math.min(nx + 22, ARC_W - 10)}
        y={ny + 34}
        textAnchor={nx > ARC_W - 200 ? "end" : "start"}
        className="pp-wk-arc-label fill-me font-sans text-[24px] font-semibold @4xl:text-[14px]"
      >
        you are here, week {week}
      </text>
      <text x="40" y="455" className="hidden fill-muted-foreground font-mono text-[12px] @4xl:block">
        {startLabel}
      </text>
      <text x="720" y="210" textAnchor="end" className="hidden fill-muted-foreground font-mono text-[12px] @4xl:block">
        {endLabel}
      </text>
    </svg>
  );
}
