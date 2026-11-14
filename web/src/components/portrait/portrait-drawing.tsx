import { Face } from "@/components/illustrations";
import { MASCOT_SHAPES, type MascotShape } from "@/components/illustrations/mascots";

/* Drawn portraits for the seeded series: the demo has no photos of real
   children, so each slot is drawn from its week or month in the shared
   illustration style. Same 4:5 canvas as a photo frame. Static on purpose:
   the flipbook is what moves. */

export type Drawing = { kind: "bump"; week: number } | { kind: "child"; month: number };

const SKIN = "#F6C9A6";
const SKIN_D = "#EBB48C";
const HAIR = "#7A4B2E";
const SWEATER = "#E8A07C";
const SWEATER_D = "#E07A52";

/** Mother in profile; the bump grows with the week and carries the shared face. */
function Bump({ week }: { week: number }) {
  const t = Math.min(1, Math.max(0, (week - 4) / 36));
  const r = 14 + t * 46; // belly radius, about 18 at week 8 to 60 at week 40
  const cx = 116 + r * 0.55;
  const cy = 200 - t * 6;
  return (
    <g>
      <circle cx="120" cy="150" r="104" fill="#FCEBD5" />
      {/* back and legs */}
      <rect x="84" y="226" width="22" height="64" rx="10" fill="#4A423A" />
      <rect x="110" y="226" width="22" height="64" rx="10" fill="#4A423A" />
      {/* torso */}
      <path d="M80 118c0-14 56-14 56 0l6 112c0 10-66 10-66 0z" fill={SWEATER} />
      {/* bump */}
      <circle cx={cx} cy={cy} r={r} fill={SWEATER} />
      <path d={`M${cx - r * 0.8} ${cy + r * 0.45}c${r * 0.5} ${r * 0.3} ${r * 1.1} ${r * 0.3} ${r * 1.6} 0`} stroke={SWEATER_D} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".6" />
      <Face x={cx + r * 0.08} y={cy - r * 0.05} s={Math.max(0.22, r / 95)} />
      {/* arm resting on the bump */}
      <path d={`M98 128c-6 34 0 62 ${cx - 106} ${cy - 132 + 4}`} stroke={SWEATER} strokeWidth="20" strokeLinecap="round" fill="none" />
      <circle cx={cx - 8} cy={cy - 6} r="10" fill={SKIN} />
      {/* head */}
      <rect x="100" y="92" width="16" height="22" rx="7" fill={SKIN_D} />
      <circle cx="112" cy="70" r="30" fill={SKIN} />
      <path d="M84 70c-4-30 26-44 50-30 8 5 10 12 8 18-14-8-30-6-40 4-6 6-12 10-18 8z" fill={HAIR} />
      <circle cx="80" cy="66" r="14" fill={HAIR} />
      <ellipse cx="128" cy="68" rx="3.4" ry="4.2" fill="#2B2620" />
      <circle cx="134" cy="80" r="6" fill="#F3B08A" opacity=".7" />
      <path d="M130 88c3 3 7 3 10 0" stroke="#2B2620" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M196 64l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#F4CD6A" />
    </g>
  );
}

function shapeFor(month: number): MascotShape {
  if (month < 4) return "newborn";
  if (month < 10) return "sitting";
  if (month < 30) return "toddler";
  return "ball";
}

/** The child at an age: the stage mascot, drawn larger as they grow. */
function Child({ month }: { month: number }) {
  const Shape = MASCOT_SHAPES[shapeFor(month)];
  const s = 0.62 + 0.4 * Math.min(1, month / 48);
  // Mascots sit on a 300x260 canvas with their feet near y=245; keep the feet on the floor line.
  const x = 120 - 150 * s;
  const y = 262 - 245 * s;
  return (
    <g>
      <circle cx="120" cy="150" r="104" fill={month < 12 ? "#D8EDEB" : "#E6EFDC"} />
      <rect x="20" y="258" width="200" height="10" rx="5" fill="#EDE3D3" />
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <Shape />
      </g>
    </g>
  );
}

export function PortraitDrawing({ drawing, className }: { drawing: Drawing; className?: string }) {
  return (
    <svg viewBox="0 0 240 300" className={className} aria-hidden="true" focusable="false">
      {drawing.kind === "bump" ? <Bump week={drawing.week} /> : <Child month={drawing.month} />}
    </svg>
  );
}
