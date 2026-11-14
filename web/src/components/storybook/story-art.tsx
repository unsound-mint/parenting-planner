import type { Stage, StoryArt as Art } from "@/lib/api/types";
import { StageMascot } from "@/components/illustrations";
import { cn } from "@/lib/utils";

// Page art for the storybook: a flat scene from the illustration set's palette
// behind the shared mascot of the child's age. The mascot brings the idle bob
// and blink from components/illustrations (off under reduced motion), so the
// scene itself stays still. Colours live in the SVG, like the other illustrations.

/** The mascot that looks like the child at this age; before birth, the two hearts. */
export function storyStage(ageMonths?: number): Stage {
  if (ageMonths === undefined) return "pregnancy";
  if (ageMonths < 6) return "postpartum";
  if (ageMonths < 12) return "infant";
  if (ageMonths < 36) return "toddler";
  if (ageMonths < 72) return "preschool";
  return "school_age";
}

const SKY: Record<Art, [string, string]> = {
  moon: ["#2E3A55", "#46557A"],
  stars: ["#33405F", "#5A6A92"],
  sunrise: ["#FCEBD5", "#F8DDB8"],
  garden: ["#E6EFDC", "#F6F1E2"],
  home: ["#FAE3D5", "#FCEBD5"],
  hearts: ["#FAE3D5", "#FBF7F0"],
  journey: ["#D8EDEB", "#F3ECE1"],
  cuddle: ["#F8DDB8", "#FAE3D5"],
};

function Star({ x, y, s = 1, fill = "#F4CD6A" }: { x: number; y: number; s?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-9l2.6 6.4L9 0l-6.4 2.6L0 9l-2.6-6.4L-9 0l6.4-2.6z" fill={fill} />;
}

function Heart({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-4c-3-5-11-3-10 3 .5 4 6 7 10 10 4-3 9.5-6 10-10 1-6-7-8-10-3z" fill={fill} />;
}

function Scene({ art }: { art: Art }) {
  switch (art) {
    case "moon":
      return (
        <g>
          <circle cx="238" cy="52" r="26" fill="#F8E7B5" />
          <circle cx="250" cy="44" r="22" fill="#2E3A55" opacity=".9" />
          <Star x={60} y={40} s={0.8} />
          <Star x={120} y={24} s={0.5} />
          <Star x={180} y={64} s={0.6} />
          <path d="M0 214c60-18 120-18 180-6s90 10 120 2v50H0z" fill="#3D4B6E" />
        </g>
      );
    case "stars":
      return (
        <g>
          {[
            [40, 36, 0.9],
            [92, 70, 0.55],
            [150, 28, 1.1],
            [214, 58, 0.7],
            [262, 30, 0.6],
            [70, 120, 0.45],
            [246, 116, 0.5],
          ].map(([x, y, s]) => (
            <Star key={`${x}-${y}`} x={x} y={y} s={s} />
          ))}
          <path d="M0 220c70-14 150-14 300 0v40H0z" fill="#41507A" />
        </g>
      );
    case "sunrise":
      return (
        <g>
          <circle cx="150" cy="196" r="70" fill="#F4CD6A" opacity=".85" />
          <path d="M0 196c50-26 110-30 160-12s100 16 140 0v76H0z" fill="#9CBF83" />
          <path d="M0 228c80-20 170-18 300 4v28H0z" fill="#7FA866" />
        </g>
      );
    case "garden":
      return (
        <g>
          <path d="M0 218c80-10 200-10 300 0v42H0z" fill="#9CBF83" />
          {[30, 70, 236, 272].map((x, i) => (
            <g key={x} transform={`translate(${x} ${206 - (i % 2) * 10})`}>
              <path d="M0 0v22" stroke="#3F6B37" strokeWidth="3" strokeLinecap="round" />
              <circle r="8" fill={i % 2 ? "#E8A07C" : "#F4CD6A"} />
              <circle r="3" fill="#FFFDF9" />
            </g>
          ))}
          <circle cx="252" cy="44" r="18" fill="#F4CD6A" />
        </g>
      );
    case "home":
      return (
        <g>
          <path d="M20 120l50-42 50 42v100H20z" fill="#FFFDF9" />
          <path d="M14 124l56-48 56 48" stroke="#E8A07C" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x="52" y="150" width="36" height="32" rx="6" fill="#F4CD6A" />
          <path d="M70 150v32M52 166h36" stroke="#E8A07C" strokeWidth="3" />
          <path d="M0 220h300v40H0z" fill="#EDE3D3" />
          <Heart x={250} y={60} s={1.4} fill="#E07A52" />
        </g>
      );
    case "hearts":
      return (
        <g>
          <Heart x={44} y={52} s={1.6} fill="#E8A07C" />
          <Heart x={252} y={40} s={1.2} fill="#7DBAB6" />
          <Heart x={262} y={150} s={0.9} fill="#E07A52" />
          <Heart x={34} y={160} s={0.8} fill="#7DBAB6" />
          <path d="M0 226c90-12 210-12 300 0v34H0z" fill="#F3ECE1" />
        </g>
      );
    case "journey":
      return (
        <g>
          <path d="M0 200c60-30 120-30 170-14s90 14 130-6v80H0z" fill="#9CBF83" />
          <path d="M150 260c-10-26 30-40 70-50s50-20 40-30" stroke="#F8DDB8" strokeWidth="16" strokeLinecap="round" fill="none" />
          <g transform="translate(46 150)">
            <path d="M0 0v50" stroke="#7A4B2E" strokeWidth="6" strokeLinecap="round" />
            <circle cy="-8" r="26" fill="#7FA866" />
          </g>
          <path d="M210 40c8-6 20-6 26 2 8-4 20 0 20 10H200c0-6 4-10 10-12z" fill="#FFFDF9" />
        </g>
      );
    case "cuddle":
      return (
        <g>
          <circle cx="150" cy="138" r="104" fill="#FCEBD5" />
          <Heart x={150} y={48} s={1.3} fill="#E07A52" />
          <path d="M40 232c40-30 180-30 220 0v28H40z" fill="#E8A07C" opacity=".55" />
          <path d="M40 232c40-30 180-30 220 0" stroke="#A04828" strokeWidth="2" strokeDasharray="4 6" fill="none" opacity=".5" />
        </g>
      );
  }
}

/**
 * One page's picture: scene plus mascot, 300x260 like the rest of the set.
 * interactive lets the mascot wiggle on tap; turn it off inside links.
 */
export function StoryArt({
  art,
  ageMonths,
  seed,
  label,
  interactive = false,
  className,
}: {
  art: Art;
  ageMonths?: number;
  seed?: string;
  label?: string;
  interactive?: boolean;
  className?: string;
}) {
  const [top, bottom] = SKY[art];
  const id = `pp-sky-${art}`;
  return (
    <div className={cn("relative isolate aspect-[300/260] w-full overflow-hidden", className)}>
      <svg viewBox="0 0 300 260" className="absolute inset-0 -z-10 size-full" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        </defs>
        <rect width="300" height="260" fill={`url(#${id})`} />
        <Scene art={art} />
      </svg>
      <div className="absolute inset-x-[18%] bottom-[4%] top-[18%]">
        <StageMascot stage={storyStage(ageMonths)} seed={seed ?? art} label={label} interactive={interactive} />
      </div>
    </div>
  );
}
