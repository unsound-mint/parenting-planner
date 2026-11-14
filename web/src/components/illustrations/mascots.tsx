import type { ReactNode } from "react";
import type { Stage } from "@/lib/api/types";
import { Face } from "./face";

/* Stage mascots on the same 300x260 canvas, flat shapes, shared Face. */

const SKIN = "#F6C9A6";
const SKIN_D = "#EBB48C";
const HAIR = "#7A4B2E";

function Heart({ cx, cy, s, rot, fill, shade }: { cx: number; cy: number; s: number; rot: number; fill: string; shade: string }) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(-84 -86)`}>
      <path d="M84 74c-6-10-22-6-20 6 1 8 12 14 20 20 8-6 19-12 20-20 2-12-14-16-20-6z" fill={fill} />
      <path d="M68 90c4 6 10 10 16 14" stroke={shade} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".5" />
    </g>
  );
}

function Hearts() {
  return (
    <g>
      <Heart cx={120} cy={146} s={3.2} rot={-8} fill="#E07A52" shade="#A04828" />
      <Heart cx={196} cy={132} s={2.7} rot={10} fill="#7DBAB6" shade="#1D6A70" />
      <Face x={118} y={140} s={0.6} rotate={-8} />
      <Face x={196} y={128} s={0.52} rotate={10} />
      <path d="M232 70l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#F4CD6A" />
      <path d="M62 84l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#F4CD6A" />
    </g>
  );
}

function Seedling() {
  return (
    <g>
      <path d="M150 168c0-30-2-50-8-70" stroke="#4F7F45" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M144 112c-8-40-44-52-76-40 6 36 40 52 76 40z" fill="#7FAE63" />
      <path d="M150 98c6-34 36-48 70-38-4 34-36 48-70 38z" fill="#8DC46B" />
      <path d="M142 110c-14-14-28-22-46-28" stroke="#5F8E4F" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M154 94c14-8 34-18 52-26" stroke="#6FA84F" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M96 168h108l-10 62c-1 6-6 10-12 10h-64c-6 0-11-4-12-10z" fill="#E8A07C" />
      <rect x="88" y="158" width="124" height="22" rx="10" fill="#E07A52" />
      <ellipse cx="150" cy="162" rx="50" ry="5" fill="#6E5A44" />
      <Face x={150} y={204} s={0.62} />
      <path d="M232 100l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#F4CD6A" />
    </g>
  );
}

function Head({ cx, cy, r, hair = true }: { cx: number; cy: number; r: number; hair?: boolean }) {
  return (
    <g>
      <circle cx={cx - r + 2} cy={cy + 4} r={r * 0.16} fill={SKIN_D} />
      <circle cx={cx + r - 2} cy={cy + 4} r={r * 0.16} fill={SKIN_D} />
      <circle cx={cx} cy={cy} r={r} fill={SKIN} />
      {hair && <path d={`M${cx - r * 0.5} ${cy - r * 0.86}c${r * 0.2}-${r * 0.28} ${r * 0.8}-${r * 0.3} ${r}-${r * 0.02}-${r * 0.4}-${r * 0.1}-${r * 0.5} ${r * 0.1}-${r * 0.9} ${r * 0.1}-${r * 0.1}-${r * 0.1}-${r * 0.1}-${r * 0.08}-${r * 0.1}-${r * 0.08}z`} fill={HAIR} />}
    </g>
  );
}

function Newborn() {
  return (
    <g>
      <path d="M86 156c0-26 128-26 128 0l-8 62c-4 24-108 24-112 0z" fill="#D8EDEB" />
      <path d="M90 172c40 16 80 16 120 0M94 200c36 14 76 14 112 0" stroke="#7DBAB6" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M92 160c30 30 80 36 116 8" stroke="#FFFDF9" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".9" />
      <Head cx={150} cy={100} r={52} hair={false} />
      <path d="M100 92c0-40 100-40 100 0-30-12-70-12-100 0z" fill="#F4CD6A" />
      <circle cx="150" cy="48" r="9" fill="#F2B84B" />
      <Face x={150} y={112} s={0.85} />
    </g>
  );
}

function SittingBaby() {
  return (
    <g>
      <ellipse cx="108" cy="214" rx="40" ry="20" fill={SKIN} transform="rotate(-14 108 214)" />
      <ellipse cx="192" cy="214" rx="40" ry="20" fill={SKIN} transform="rotate(14 192 214)" />
      <circle cx="72" cy="224" r="14" fill={SKIN_D} />
      <circle cx="228" cy="224" r="14" fill={SKIN_D} />
      <path d="M108 128c0-14 84-14 84 0v70c0 22-84 22-84 0z" fill="#F4CD6A" />
      <path d="M118 164h64" stroke="#F2B84B" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="100" cy="150" rx="12" ry="26" fill={SKIN} transform="rotate(28 100 150)" />
      <ellipse cx="206" cy="112" rx="12" ry="28" fill={SKIN} transform="rotate(-32 206 112)" />
      <circle cx="218" cy="88" r="12" fill={SKIN_D} />
      <Head cx={150} cy={86} r={52} />
      <Face x={150} y={98} s={0.85} />
    </g>
  );
}

function Toddler() {
  return (
    <g>
      <ellipse cx="128" cy="204" rx="12" ry="32" fill={SKIN} transform="rotate(18 128 204)" />
      <ellipse cx="174" cy="206" rx="12" ry="30" fill={SKIN} transform="rotate(-14 174 206)" />
      <ellipse cx="116" cy="236" rx="22" ry="10" fill="#4A423A" />
      <ellipse cx="184" cy="236" rx="22" ry="10" fill="#4A423A" />
      <ellipse cx="94" cy="140" rx="11" ry="28" fill={SKIN} transform="rotate(48 94 140)" />
      <ellipse cx="206" cy="132" rx="11" ry="28" fill={SKIN} transform="rotate(-52 206 132)" />
      <path d="M118 112c0-10 64-10 64 0l16 78c0 14-96 14-96 0z" fill="#E8A07C" />
      <path d="M106 192c30 10 58 10 88 0" stroke="#E07A52" strokeWidth="6" strokeLinecap="round" fill="none" />
      <Head cx={150} cy={72} r={46} />
      <Face x={150} y={82} s={0.8} />
    </g>
  );
}

function PreschoolBall() {
  return (
    <g>
      <rect x="112" y="176" width="22" height="50" rx="10" fill={SKIN} />
      <rect x="148" y="176" width="22" height="50" rx="10" fill={SKIN} />
      <ellipse cx="116" cy="236" rx="22" ry="10" fill="#4A423A" />
      <ellipse cx="164" cy="236" rx="22" ry="10" fill="#4A423A" />
      <path d="M104 160c0-8 76-8 76 0l4 30c0 8-84 8-84 0z" fill="#1D6A70" />
      <path d="M104 104c0-10 76-10 76 0l4 62c0 8-84 8-84 0z" fill="#7DBAB6" />
      <ellipse cx="96" cy="130" rx="11" ry="30" fill={SKIN} transform="rotate(14 96 130)" />
      <ellipse cx="178" cy="148" rx="11" ry="30" fill={SKIN} transform="rotate(-56 178 148)" />
      <circle cx="224" cy="178" r="34" fill="#F4CD6A" />
      <path d="M192 170c20 6 44 6 64 0M196 196c18-6 40-6 56 0M224 144c-10 20-10 48 0 68" stroke="#E07A52" strokeWidth="6" strokeLinecap="round" fill="none" />
      <Head cx={144} cy={62} r={44} />
      <Face x={144} y={72} s={0.78} />
    </g>
  );
}

function SchoolBackpack() {
  return (
    <g>
      <rect x="82" y="96" width="136" height="104" rx="26" fill="#E07A52" />
      <rect x="92" y="150" width="116" height="40" rx="14" fill="#C9603A" />
      <path d="M130 94c0-14 40-14 40 0" stroke="#A04828" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="116" y="176" width="22" height="50" rx="10" fill="#4A423A" transform="rotate(4 127 200)" />
      <rect x="162" y="176" width="22" height="50" rx="10" fill="#4A423A" transform="rotate(-4 173 200)" />
      <ellipse cx="124" cy="236" rx="22" ry="10" fill="#2B2620" />
      <ellipse cx="180" cy="236" rx="22" ry="10" fill="#2B2620" />
      <path d="M112 110c0-10 76-10 76 0l6 70c0 8-88 8-88 0z" fill="#1D6A70" />
      <path d="M124 104v62M176 104v62" stroke="#E07A52" strokeWidth="7" strokeLinecap="round" opacity=".9" />
      <ellipse cx="102" cy="144" rx="11" ry="30" fill={SKIN} transform="rotate(8 102 144)" />
      <ellipse cx="198" cy="144" rx="11" ry="30" fill={SKIN} transform="rotate(-8 198 144)" />
      <Head cx={150} cy={58} r={42} />
      <Face x={150} y={68} s={0.76} />
    </g>
  );
}

export const MASCOT_SHAPES = {
  hearts: Hearts,
  seedling: Seedling,
  newborn: Newborn,
  sitting: SittingBaby,
  toddler: Toddler,
  ball: PreschoolBall,
  backpack: SchoolBackpack,
} satisfies Record<string, () => ReactNode>;

export type MascotShape = keyof typeof MASCOT_SHAPES;

/** The mascot that stands for each family stage; shared with the share card image. */
export const STAGE_SHAPE: Record<Stage, MascotShape> = {
  planning: "hearts",
  trying: "seedling",
  pregnancy: "hearts",
  postpartum: "newborn",
  infant: "sitting",
  toddler: "toddler",
  preschool: "ball",
  school_age: "backpack",
};

